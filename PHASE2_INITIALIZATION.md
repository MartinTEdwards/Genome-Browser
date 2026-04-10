# Phase 2 initialization handoff — Genome Explorer

This document captures the **domain concepts**, **data conventions**, **NCBI integration**, **directon / IGD semantics**, **COG-based cross-genome analysis**, and **existing Gene Ontology plumbing** from phase one. It is written so a fresh development environment (or a new Cursor session) can reconstruct the project’s intent and engineering details without reading the entire repository first.

---

## 1. Project purpose: phase one vs phase two

### Phase one (this repository)

- **Prokaryotic reference-genome browser** backed by the NCBI Datasets API and SQLite (Prisma).
- **Browser tab:** Select an assembly, load annotations into the local DB, paginate and filter a gene table (molecule type, search on gene name / protein accession / GO JSON substring).
- **Directon Analysis tab:** Optionally load a **corpus** of genomes, aggregate **directons** (strand-coherent runs), treat **COG IDs** as **tokens** in an operon-scale **“sentence,”** then compare directons **across genomes** with a **hypergeometric** significance test and **partition** large directons where independent recurrent subsequences suggest **multiple operons** inside one strand block.

**Product hypothesis (carried forward):** With **large numbers of genomes**, **proper multiple testing**, and **sound sampling**, very strong recurrent patterns should often correspond to **operons** — functional “sentences” along the chromosome.

### Phase two (next project)

- **Replace COG** as the functional token with **Gene Ontology (GO) class / ID** (and likely human-readable labels via a local or cached ontology).
- **Shift the UI** from a **dashboard / exploratory list** toward **user-driven analytical workflows**: a **number cruncher** — parameterized batch runs, summary tables, exports, reproducibility — not primarily a dynamic genome browser.
- **Statistics and scale:** Phase one’s pairwise directon loop is **O(D²)** in the number of directons; phase two must explicitly design for **corpus scale**, **multi-GO per gene**, and **appropriate null models** (see section 8).

---

## 2. Core biology and informatics vocabulary (as implemented)

### 2.1 Coordinates and strand

Source: NCBI Datasets **annotation_report** genomic region (`gene_range.range[0]`).

| NCBI field     | Stored field   | Meaning |
|----------------|----------------|---------|
| `begin`        | `startCoord`   | Integer; **lower** genomic coordinate on the reference replicon. |
| `end`          | `stopCoord`    | Integer; **higher** genomic coordinate. |
| `orientation`  | `strand`       | `'minus'` → `'-'`; otherwise `'+'`. |

**Convention:** `begin` < `end` on the reference regardless of strand. So `startCoord` and `stopCoord` are **genomic low and high endpoints**, not automatic synonyms for **transcription start** and **transcription stop** in the everyday sense.

### 2.2 Negative strand and “start/stop” reasoning (IGD)

On the **minus** strand, **biological** transcription runs **opposite** to increasing genomic coordinates: **5′→3′** proceeds **from `stopCoord` toward `startCoord`** (high coordinate toward low).

When reasoning about **which end of a gene abuts a neighbor**, **upstream/downstream along transcription**, or **operon polarity**, you **must** use **strand** explicitly. Do **not** assume that `startCoord` “is” the TSS without checking orientation. This was the key clarification for **correct mental models** when discussing **intergenic distance** and adjacency on **negative** strands: the **numeric** `begin`/`end` pair is stable; the **biological** roles of those ends **swap** relative to transcription direction compared to the plus strand.

### 2.3 Intergenic distance (IGD)

**Implementation:** `annotateGenes` in `src/app/api/genomes/load/route.ts` (single pass per molecule type).

1. Group genes by `moleculeType`.
2. Within each group, sort by **`startCoord` ascending**.
3. Walk the sorted list. Track `prevStrand` and `prevStopCoord`.
4. **Same strand as previous gene** and `prevStopCoord !== null`:  
   `intergenicDistance = gene.startCoord - prevStopCoord`  
   i.e. **current genomic low minus previous genomic high** — the gap along the reference between the previous feature’s high end and the current feature’s low end.
5. **Strand change:** increment `directonId`, set `boundaryType` (see below), **do not** compute IGD for that transition step in the same way as same-strand spacing (first gene of a new directon has no same-strand predecessor in the walk).
6. **First gene** in each molecule group: no IGD from a prior gene.

**Negative IGD:** If annotations **overlap** on the same strand (or data are inconsistent), `current.startCoord - previous.stopCoord` can be **negative**. The Browser UI renders negative values distinctly (e.g. red) in `src/app/page.tsx`.

### 2.4 Directon

**Definition (operational):** A **maximal run** of consecutive genes, in **`startCoord` sort order within a molecule type**, that share the **same `strand`**.

**`directonId`:** A counter that **increments each time** `gene.strand !== prevStrand` (after the first gene in a molecule group). So each directon is a strand-homogeneous block in **reference coordinate order**, not necessarily a single operon biologically.

### 2.5 Boundary types at strand transitions

When `prevStrand !== null` and `gene.strand !== prevStrand`:

- If **`prevStrand === '+'`** → **`Convergent`** (plus then minus: **+→−**).
- Else (**previous was minus**, current is plus) → **`Divergent`** (**−→+**).

Comment in code: *Convergent = +→− | Divergent = −→+* (`src/app/api/genomes/load/route.ts`).

### 2.6 Molecule ordering during annotation

Within `annotateGenes`, molecule types are processed in this **explicit order**: **Chromosome** first, **Plasmid** second, then everything else (`molOrder` in the load route). Note: **plasmid genes are dropped earlier** during raw gene collection (see section 4), so plasmid rows typically never enter this pipeline for loaded data.

---

## 3. Data model and storage

**Schema:** `prisma/schema.prisma` (SQLite via `DATABASE_URL`).

- **`Genome`:** `accession` (unique), `organism`, `totalGenes`, relation to `GeneAnnotation[]`.
- **`GeneAnnotation`:**  
  `proteinAccession`, `geneName`, `sequenceAccession`, `moleculeType`, `strand`, `startCoord`, `stopCoord`,  
  `intergenicDistance` (nullable), `directonId`, `boundaryType` (nullable),  
  `cogId`, `cogCategory` (nullable),  
  **`goTerms`:** string storing **JSON** — a sorted JSON array of GO ID strings, e.g. `["GO:0003674","GO:0006355"]`.

**List ordering (API):** `src/app/api/annotations/route.ts` orders by `moleculeType` ascending, then `startCoord` ascending. Pagination: `pageSize = 100`.

---

## 4. NCBI ingestion pipeline

**Authoritative implementation:** `src/app/api/genomes/load/route.ts`.

**Constants in that file:**

- `NCBI_BASE = 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha'`
- `COG_API = 'https://www.ncbi.nlm.nih.gov/research/cog/api/cog'`

### 4.1 Genome list (reference bacteria)

**Route:** `src/app/api/genomes/route.ts`

- Endpoint: `GET https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/taxon/2/dataset_report?filters.reference_only=true&page_size=20`
- **Limitation:** Only the **first page** (`page_size=20`) is fetched; there is **no UI pagination** over the full taxon catalog. Phase two may need full catalog or search.

### 4.2 Molecule type map

- `GET ${NCBI_BASE}/genome/accession/{accession}/sequence_reports?page_size=200`
- Builds `refseq_accession → assigned_molecule_location_type` for attaching **Chromosome** / **Plasmid** / etc. to each gene via its `sequenceAccession`.

### 4.3 Annotation pages

- `GET ${NCBI_BASE}/genome/accession/{accession}/annotation_report?page_size=1000` (+ `page_token` when present).
- Loop until no `next_page_token` or **`pageNum >= 50`** (hard cap).

### 4.4 Plasmid exclusion at ingest

During the annotation loop, if `moleculeType === 'Plasmid'`, the row is **`continue`**’d — **not** inserted into `rawGenes`. Loaded assemblies are therefore **chromosome-oriented** (plus any non-plasmid types that appear, e.g. **Unknown**).

### 4.5 COG map

- Initial URL: `${COG_API}/?assembly=${accession}&format=json&limit=1000`
- Follow `next` links. **Important:** Normalize host — strip `https?://[^/]+` from `next` and prefix `https://www.ncbi.nlm.nih.gov` so internal NCBI hostnames do not break client fetches.
- **Multiple COG hits per protein:** Keep the hit with the **largest `bitscore`**.
- Stored: `cogId`, and `cogCategory` from `cog.funcats[0].name` (a **functional category label** from the API — **not** guaranteed to be the single-letter COG class). The Browser tab defines a **letter → description** map (`COG_CATEGORIES` in `page.tsx`) for display; **do not assume** DB `cogCategory` is always that single letter.

### 4.6 Gene Ontology (GO) map — phase-two precursor

- **Batch request:** `GET ${NCBI_BASE}/gene/accession/{id1,id2,...}` with IDs **URL-encoded** and joined by commas.
- **`batchSize = 45`**
- **Delay:** `80` ms between batches (`await new Promise((r) => setTimeout(r, 80))`).
- Parses `gene_ontology` / `geneOntology` with both **snake_case** and **camelCase** keys for molecular function, biological process, and cellular component lists; collects `go_id` / `goId`.
- Merges all GO IDs per protein accession (from `report.query` or nested `proteins[].accession_version`); **failures are best-effort** (empty list).
- **`attachGoTerms`:** serializes sorted unique IDs into `goTerms` JSON string on each annotated gene.

---

## 5. Directon aggregation for analysis API

**Route:** `src/app/api/directons/route.ts`

- Loads annotations with `moleculeType != 'Plasmid'` (defense in depth; load already skipped plasmids).
- **Composite key per logical directon:**  
  `repliconKey = sequenceAccession || moleculeType`  
  `key = "${genomeId}-${repliconKey}-${directonId}"`  
  **Rationale:** Multiple replicons can share the same `moleculeType`; **sequence accession** disambiguates so distinct replicons are **not merged** into one directon bucket.
- **`genes`:** unique **`cogId`** values (`Set`) aggregated across all genes in that directon — these become **`Directon.genes`** in analysis (typed as COG ID strings in `src/lib/directon-analysis/types.ts`).
- **Strand on the directon:** taken from annotations as they appear when building the entry (first row wins for that key); stored as `'+'` or `'-'`.

---

## 6. Statistical and algorithmic core

**Library:** `src/lib/directon-analysis/`

### 6.1 Types (`types.ts`)

- **`Directon`:** `id`, `genomeId`, `genomeAccession`, `moleculeType`, `strand`, `directonId`, **`genes: Set<COG_ID>`**, **`size`** (gene set size — count of distinct COGs in the directon).
- **`Genome`:** `id`, `accession`, `organism`, `directons[]`.
- **`ComparisonResult`:** `sourceId`, `targetId`, `overlapCount`, `sharedCogs`, `pValue`, `score` (currently same as `pValue`).

### 6.2 `DirectonAnalyzer` (`analyzer.ts`)

**Constants:**

- `MIN_OVERLAP = 2`
- `P_VALUE_THRESHOLD = 0.001`

**Universe size `N`:** Number of **distinct COG IDs** appearing in **any** directon across **all** genomes in the corpus (`Set` over all `d.genes`).

**Pairwise loop:** For each directon `d1`, for each `d2` where **`d1.id !== d2.id`** and **`d1.genomeId !== d2.genomeId`**:

- Intersection size = overlap of `Set` COGs.
- If overlap **≥ `MIN_OVERLAP`**, compute **one-sided hypergeometric tail probability** `ScoringEngine.calculatePValue(N, M, n, k)` with:
  - `M = d1.size`
  - `n = d2.size`
  - `k = intersection size`
- If **`pVal < P_VALUE_THRESHOLD`**, record a **`ComparisonResult`**.

**Interpretation note:** Drawing **without replacement** from a single universe of **COG types** is a deliberate simplification; phase two must revisit this when tokens are **GO terms** (multi-label per gene, correlation between terms, etc.).

### 6.3 Hypergeometric p-value (`scoring.ts`)

**`calculatePValue(N, M, n, k)`:**

- `N` — universe size  
- `M` — size of set A (directon A)  
- `n` — size of set B  
- `k` — intersection size  

Computes the **upper tail**: sum from `i = k` to `min(M, n)` of  

\[
\frac{\binom{M}{i}\binom{N-M}{n-i}}{\binom{N}{n}}
\]

**Combinations** use **log-factorial** accumulation to reduce overflow (`lnFactorial` / `exp` difference).

Edge cases: if `k > min(M,n)` or `N <= 0`, returns `1`; result capped with `Math.min(1, pValue)`.

### 6.4 Deconvolution — “sentences” inside a directon (`deconvoluter.ts`)

Given a target directon and its **significant** `matches`:

- For each match, take **`sharedCogs`** that lie in the target.
- Add **edges** between every **pair** of those COGs (clique-like linkage from each match).
- **BFS** connected components → **`partitions: Set<string>[]`**.

**UI meaning:** If **`partitions.length > 1`**, the UI treats the directon as **multi-operon** (multiple “sentences”) for summary counts (`DirectonAnalysisTab.tsx`).

### 6.5 Other utilities (not driving the main analyzer path)

- **`ScoringEngine.overlapCoefficient`** — intersection / min(|A|,|B|).
- **`AdvancedScoring.calculateWeightedScore`** — sum of \(-\log_2\) frequencies over shared COGs; **not** used inside `DirectonAnalyzer` today.
- **`GeneBitSet`** (`gene-bitset.ts`) — bitwise intersection counting; **analyzer uses `Set` and array `filter`** for intersections — fine for small corpora, **not** for phase two scale without redesign.

---

## 7. UI architecture (phase one)

**Stack:** Next.js 16 (App Router), React 19, Prisma + SQLite, Tailwind CSS 4. See `README.md`.

| Area | Location | Role |
|------|----------|------|
| Browser tab | `src/app/page.tsx` | Genome select, load, filters, search, paginated annotation table (strand, IGD, directon, COG, GO preview). |
| Directon Analysis tab | `src/components/DirectonAnalysisTab.tsx` | Sequential `POST /api/genomes/load` over corpus, then `GET /api/directons`, `new DirectonAnalyzer(genomes).analyze()`. |
| Visualization | `src/components/directon-viz/*` | `DirectonVisualizer`, tracks, partitions, evidence heatmap; match filter **p < 0.001** in copy. |

**E2E:** Cypress tests under `cypress/e2e/`.

---

## 8. Phase two engineering checklist

1. **Token model:** Replace per-directon **`Set<cogId>`** with **GO IDs** (or a slim / aspect-filtered subset). Decide: **Set vs multiset**, **IA vs regulation**, **propagation** (ancestors on the GO DAG), and **missing annotation** handling.
2. **Null model and multiple testing:** Hypergeometric on a **flat universe of types** is fragile for GO (dependencies, variable depth, gene linkage). Plan **enrichment-style** or **permutation** nulls, **FDR** across hypotheses, and **explicit sampling** across genomes.
3. **Ingest:** Reduce or remove **COG API** dependency; strengthen **GO** fetch or **bulk files**; optional **local OBO** for labels and aspect. Keep **plasmid / replicon** policy explicit in docs and UI.
4. **Performance:** Replace **O(D²)** all-pairs directon comparison with **inverted indexes**, **MinHash / LSH**, **bitmaps** (`GeneBitSet`-style with stable GO indexing), or **pre-aggregated** statistics — required for **large D** and **large genomes**.
5. **UX:** **Job-oriented** flows: parameters, run id, tables, CSV/Parquet export, **reproducible** seeds and versions (assembly, annotation date, ontology version).

---

## 9. Data flow diagram

```mermaid
flowchart LR
  subgraph ncbi [NCBI APIs]
    DS[Datasets v2alpha]
    COG[COG API]
  end
  subgraph load [Load route]
    AR[annotation_report pages]
    SR[sequence_reports]
    GM[fetchGoMap batches]
    AG[annotateGenes]
    AT[attachGoTerms]
  end
  subgraph store [Storage]
    DB[(Prisma SQLite)]
  end
  subgraph api [Read APIs]
    AN[/api/annotations]
    DI[/api/directons]
  end
  subgraph analyze [Client analysis]
    DA[DirectonAnalyzer]
    DC[DirectonDeconvoluter]
    UI[DirectonVisualizer]
  end
  DS --> AR
  DS --> SR
  DS --> GM
  COG --> load
  AR --> AG
  SR --> AG
  AG --> AT
  AT --> DB
  DB --> AN
  DB --> DI
  DI --> DA
  DA --> DC
  DA --> UI
  DC --> UI
```

---

## 10. Key source files (quick index)

| Topic | Path |
|-------|------|
| Ingestion, IGD, directons, COG/GO fetch | `src/app/api/genomes/load/route.ts` |
| Annotation pagination / search | `src/app/api/annotations/route.ts` |
| Directon JSON for analysis | `src/app/api/directons/route.ts` |
| Genome list | `src/app/api/genomes/route.ts` |
| Analyzer thresholds, pairwise loop | `src/lib/directon-analysis/analyzer.ts` |
| Hypergeometric + overlap / weighted helpers | `src/lib/directon-analysis/scoring.ts` |
| Partitioning | `src/lib/directon-analysis/deconvoluter.ts` |
| Types | `src/lib/directon-analysis/types.ts` |
| Schema | `prisma/schema.prisma` |

---

## 11. Verification log (constants vs code)

| Item | Documented value | Source |
|------|------------------|--------|
| `NCBI_BASE` | `https://api.ncbi.nlm.nih.gov/datasets/v2alpha` | `load/route.ts` |
| `COG_API` | `https://www.ncbi.nlm.nih.gov/research/cog/api/cog` | `load/route.ts` |
| GO batch size | `45` | `fetchGoMap` in `load/route.ts` |
| Inter-batch delay | `80` ms | `fetchGoMap` in `load/route.ts` |
| Annotation page size | `1000` | `load/route.ts` |
| Max annotation pages | `50` | `load/route.ts` (`pageNum < 50`) |
| Genome list page size | `20` | `genomes/route.ts` |
| Annotation API page size | `100` | `annotations/route.ts` |
| `MIN_OVERLAP` | `2` | `analyzer.ts` |
| `P_VALUE_THRESHOLD` | `0.001` | `analyzer.ts` |

This file should be copied or linked into the **next repository** as the **authoritative bootstrap** for phase two.
