# Cypress genome fixtures (offline E2E)

Genome Explorer can run end-to-end tests **without calling NCBI** by loading pre-parsed genome data from JSON files in this folder. The data is produced once from the real app load pipeline, then replayed in Cypress via `cy.intercept`.

Default fixture: **`GCF_000195955.2.json`** — *Mycobacterium tuberculosis* str. H37Rv, 100 sample genes (of ~4000 total in a full load).

Additional committed fixtures (100 genes each):

| File | Organism |
|------|----------|
| `GCF_000005845.2.json` | *Escherichia coli* str. K-12 substr. MG1655 |
| `GCF_000009045.1.json` | *Bacillus subtilis* subsp. subtilis str. 168 |

---

## Command line: generating a fixture

### Prerequisites (network required once)

1. **Dev server** on port 3000:
   ```bash
   npm run dev
   ```
2. **MetaCyc mappings** loaded (so EC fields match production). Either open the app once in the browser, or:
   ```bash
   curl -X POST http://localhost:3000/api/metacyc/ingest
   ```
3. **TLS on Windows:** `npm run dev` and `npm run fixture:genome` already use `node --use-system-ca` so NCBI HTTPS works.

### Quick start

From the repo root, with the dev server running:

```bash
npm run fixture:genome
```

This writes:

`cypress/fixtures/GCF_000195955.2.json`

### CLI options

Pass arguments after `--` so npm forwards them to the script:

```bash
npm run fixture:genome -- --help
npm run fixture:genome -- --accession GCF_000195955.2 --sample-size 100
npm run fixture:genome -- --organism "Mycobacterium tuberculosis H37Rv"
npm run fixture:genome -- --accession GCF_000005845.2 --organism "Escherichia coli str. K-12 substr. MG1655" --sample-size 100
npm run fixture:genome -- --accession GCF_000009045.1 --organism "Bacillus subtilis subsp. subtilis str. 168" --sample-size 100
npm run fixture:genome -- --out-dir cypress/fixtures
npm run fixture:genome -- --base-url http://localhost:3000
```

| Option | Default | Description |
|--------|---------|-------------|
| `--accession` | `GCF_000195955.2` | NCBI assembly accession to load |
| `--organism` | *M. tuberculosis* H37Rv label | Passed to `POST /api/genomes/load` as `organismName` |
| `--sample-size` | `100` | Number of genes exported into the fixture (first rows by molecule + start coord) |
| `--out-dir` | `cypress/fixtures` | Output directory (filename = `<accession>.json`) |
| `--base-url` | `http://localhost:3000` | App URL for the load API |

### What the script does

1. `POST /api/genomes/load` — same path the UI uses (NCBI fetch, directon annotation, Prisma insert).
2. Reads the genome and a **sample** of `GeneAnnotation` rows from SQLite via Prisma.
3. Writes JSON including a ready-made **`annotationsPage1`** payload for Cypress stubs.

Implementation:

- CLI: [`scripts/download-cypress-fixture.mjs`](../../scripts/download-cypress-fixture.mjs)
- Helper: [`scripts/lib/downloadGenomeFixture.mjs`](../../scripts/lib/downloadGenomeFixture.mjs)

### Programmatic use (Node)

```javascript
import { downloadGenomeFixture } from './scripts/lib/downloadGenomeFixture.mjs'

const { outPath, totalGenes, sampleSize } = await downloadGenomeFixture({
  accession: 'GCF_000195955.2',
  organismName: 'Mycobacterium tuberculosis H37Rv',
  sampleSize: 100,
})
console.log(outPath, totalGenes, sampleSize)
```

Requires `npm run dev` and the same prerequisites as above.

### Committing fixtures

Sample fixtures (~100 genes) are small enough to commit. After regenerating:

```bash
git add cypress/fixtures/GCF_000195955.2.json
```

Re-run `npm run fixture:genome` if the load pipeline or schema changes.

---

## Fixture file format

Each `<accession>.json` file contains:

| Field | Purpose |
|-------|---------|
| `accession`, `organism`, `totalGenes` | Genome metadata |
| `sampleSize` | Number of genes in the sample |
| `genes` | Gene rows (no `genomeId`; for custom stubs) |
| `annotationsPage1` | Body for `GET /api/annotations?...` (page 1, no search) |
| `loadedListEntry` | One row for `GET /api/genomes/loaded` |
| `catalogEntry` | One row for `GET /api/genomes?*` (NCBI catalog shape: `organismName`, etc.) |
| `loadResponse` | Optional body for `POST /api/genomes/load` |

`annotationsPage1.annotations` uses synthetic `id` values `1..N` for stable table keys in tests.

---

## Cypress: using fixtures in tests

Support code lives in [`cypress/support/genome-fixture.ts`](../support/genome-fixture.ts) and is loaded from [`cypress/support/e2e.ts`](../support/e2e.ts).

### `cy.stubGenomeFromFixture(accession)`

Sugar for a **single** fixture: `stubGenomesFromFixtures([accession])`. The catalog shows one row.

### `cy.stubGenomesFromFixtures(accessions[])`

Registers intercepts for a **short multi-genome list** (e.g. three 100-gene fixtures for downloaded-list tests):

| Request | Stubbed response |
|---------|------------------|
| `GET **/api/genomes?*` | All `catalogEntry` rows, sorted by accession; page 2+ returns empty |
| `GET **/api/genomes/loaded*` | **Empty** until load/seed; then all downloaded accessions (sorted), with `?all=true` and pagination |
| `GET **/api/annotations*accession=<accession>*` | `annotationsPage1` per accession (`@annotations` if one genome; else `@annotations_<accession>`) |
| `POST **/api/genomes/load` | Routes by `req.body.accession`; marks that genome downloaded |
| `DELETE **/api/genomes` | Clears each accession in `req.body.accessions`; partial delete supported |

Aliases: `@catalogGenomes`, `@loadedGenomes`, `@loadGenome`, `@deleteGenomes`, plus annotation aliases above.

```typescript
const THREE = ['GCF_000005845.2', 'GCF_000009045.1', 'GCF_000195955.2']

beforeEach(() => {
  cy.stubGenomesFromFixtures(THREE)
  cy.visit('/')
})
```

Without the `DELETE` stub, the UI shows the genome (from the fixture intercept) but the real API returns `Not found` if that accession is not in SQLite.

### Deferred loaded fetches (app + stub)

On `cy.visit('/')`, the app **does not** call `GET /api/genomes/loaded`:

- **Genome Management** — downloaded list stays empty until Download, pagination, or delete refresh.
- **Genome Summary / Directon Analysis** — loaded genomes fetch when you open that tab.

The stub matches this: `GET loaded` returns empty until you seed or complete a Download.

### `cy.seedDownloadedGenome(accession)`

Marks the fixture genome as downloaded in stub state **without** clicking Download. Use when a test needs Summary or delete behavior but should skip the catalog download UI.

```typescript
cy.stubGenomeFromFixture('GCF_000195955.2')
cy.visit('/')
cy.seedDownloadedGenome('GCF_000195955.2')
cy.contains('Genome Summary').click()
cy.wait('@loadedGenomes')
```

For Genome Management delete tests that need the right-hand downloaded list, either seed and trigger a fetch (e.g. via Download) or walk the full Download flow.

### Example: Genome Summary (offline)

```typescript
describe('Genome Summary (offline)', () => {
  beforeEach(() => {
    cy.stubGenomeFromFixture('GCF_000195955.2')
    cy.visit('/')
  })

  it('shows annotations for the fixture genome', () => {
    cy.seedDownloadedGenome('GCF_000195955.2')
    cy.contains('Genome Summary').click()
    cy.wait('@loadedGenomes')
    cy.get('select').select('GCF_000195955.2')
    cy.wait('@annotations')
    cy.contains('dnaA').should('be.visible')
    cy.contains('Total genes in DB:').should('be.visible')
  })
})
```

Call **`stubGenomeFromFixture` before `cy.visit`** so the first API calls are intercepted.

### Example: import the helper directly

```typescript
import { stubGenomeFromFixture } from '../support/genome-fixture'

beforeEach(() => {
  stubGenomeFromFixture('GCF_000195955.2')
  cy.visit('/')
})
```

### Reading the fixture without intercepts

```typescript
cy.fixture('GCF_000195955.2').then((fx) => {
  expect(fx.sampleSize).to.eq(100)
  expect(fx.annotationsPage1.annotations[0].geneName).to.eq('dnaA')
})
```

Cypress resolves `GCF_000195955.2` to `cypress/fixtures/GCF_000195955.2.json` (no network).

### Waiting on stubbed requests

```typescript
cy.get('select').select('GCF_000195955.2')
cy.wait('@annotations').its('response.statusCode').should('eq', 200)
```

---

## Limitations

- **Sample only:** The fixture holds 100 genes, not the full genome. `totalGenes` in metadata reflects the real DB count; the annotations stub returns only the sample rows.
- **Not stubbed:** NCBI catalog pagination (`GET /api/genomes?pageSize=25`) — Genome Management tests that browse the available list still need network or separate catalog mocks.
- **Regeneration:** If load logic changes, re-run `npm run fixture:genome` and commit the updated JSON.
- **Search / pagination:** The default intercept matches annotation requests for the accession; search filters and page 2+ are not simulated unless you add more intercepts using `fx.genes`.

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| `POST /api/genomes/load failed` | Ensure `npm run dev` is running on `--base-url` |
| TLS / certificate errors | Use `npm run dev` and `npm run fixture:genome` (not plain `next dev`) |
| Empty EC fields in fixture | Run MetaCyc ingest before generating |
| `cy.fixture` not found | Filename must match accession: `GCF_000195955.2.json` → `cy.fixture('GCF_000195955.2')` |
| Intercept not hit | Call `stubGenomeFromFixture` before `visit`; check accession string matches the URL |
