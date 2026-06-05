/**
 * Stub genome APIs from a Cypress fixture (no NCBI / load network).
 * Generate fixtures with: npm run fixture:genome
 */

export interface CatalogEntry {
  accession: string
  organismName: string
  strain: string
  assemblyName: string
  totalGenes: number | string
}

export interface GenomeFixture {
  accession: string
  organism: string
  totalGenes: number
  sampleSize: number
  catalogEntry?: CatalogEntry
  annotationsPage1: {
    organism: string
    totalGenes: number
    total: number
    page: number
    pageSize: number
    annotations: unknown[]
  }
  loadedListEntry: {
    accession: string
    organism: string
    totalGenes: number
  }
  loadResponse?: { success: boolean; totalGenes: number }
}

function catalogEntryFromFixture(fx: GenomeFixture): CatalogEntry {
  return (
    fx.catalogEntry ?? {
      accession: fx.accession,
      organismName: fx.organism,
      strain: '',
      assemblyName: '',
      totalGenes: fx.totalGenes,
    }
  )
}

const fixtureRegistry: Record<string, GenomeFixture> = {}

/** Per-accession stub state: downloaded list empty until POST load or seed. */
const genomeInDownloadedList: Record<string, boolean> = {}

function sortedDownloadedEntries() {
  return Object.keys(fixtureRegistry)
    .filter((acc) => genomeInDownloadedList[acc])
    .sort()
    .map((acc) => fixtureRegistry[acc].loadedListEntry)
}

function buildLoadedResponse(req: { url: string }) {
  const url = new URL(req.url)
  const all = url.searchParams.get('all') === 'true'
  const entries = sortedDownloadedEntries()
  const accessions = entries.map((e) => e.accession)

  if (all) {
    return {
      genomes: entries,
      loadedAccessions: accessions,
      total: entries.length,
    }
  }

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(
    25,
    Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10))
  )
  const skip = (page - 1) * pageSize
  const slice = entries.slice(skip, skip + pageSize)

  return {
    genomes: slice,
    loadedAccessions: slice.map((e) => e.accession),
    total: entries.length,
    page,
    pageSize,
  }
}

function registerGenomeIntercepts() {
  cy.intercept('GET', '**/api/genomes?*', (req) => {
    const url = new URL(req.url)
    const pageToken = url.searchParams.get('pageToken')
    if (pageToken) {
      req.reply({ statusCode: 200, body: { genomes: [], pageSize: 25 } })
      return
    }
    const genomes = Object.values(fixtureRegistry)
      .map(catalogEntryFromFixture)
      .sort((a, b) => a.accession.localeCompare(b.accession))
    req.reply({
      statusCode: 200,
      body: { genomes, pageSize: 25 },
    })
  }).as('catalogGenomes')

  cy.intercept('GET', '**/api/genomes/loaded*', (req) => {
    req.reply({
      statusCode: 200,
      body: buildLoadedResponse(req),
    })
  }).as('loadedGenomes')

  cy.intercept('POST', '**/api/genomes/load', (req) => {
    const body = req.body as { accession?: string }
    const accession = body?.accession
    if (!accession || !fixtureRegistry[accession]) {
      req.reply({ statusCode: 404, body: { error: 'Unknown accession' } })
      return
    }
    const fx = fixtureRegistry[accession]
    genomeInDownloadedList[accession] = true
    req.reply({
      statusCode: 200,
      body: fx.loadResponse ?? {
        success: true,
        totalGenes: fx.totalGenes,
      },
    })
  }).as('loadGenome')

  cy.intercept('DELETE', '**/api/genomes', (req) => {
    const body = req.body as { accessions?: string[] }
    const accessions = body?.accessions ?? []
    const deleted: string[] = []
    for (const accession of accessions) {
      if (fixtureRegistry[accession]) {
        genomeInDownloadedList[accession] = false
        deleted.push(accession)
      }
    }
    req.reply({
      statusCode: 200,
      body: { deleted, failed: [] },
    })
  }).as('deleteGenomes')
}

function registerAnnotationIntercepts(accessions: string[]) {
  accessions.forEach((accession) => {
    const fx = fixtureRegistry[accession]
    const alias = accessions.length === 1 ? 'annotations' : `annotations_${accession}`
    cy.intercept('GET', `**/api/annotations*accession=${accession}*`, fx.annotationsPage1).as(
      alias
    )
  })
}

function loadFixturesIntoRegistry(accessions: string[], index: number): Cypress.Chainable {
  if (index >= accessions.length) {
    registerAnnotationIntercepts(accessions)
    return cy.wrap(null)
  }
  const accession = accessions[index]
  return cy.fixture(accession).then((raw) => {
    fixtureRegistry[accession] = raw as GenomeFixture
    return loadFixturesIntoRegistry(accessions, index + 1)
  })
}

/** Mark a fixture genome as downloaded without walking the Download UI. */
export function seedDownloadedGenome(accession: string) {
  genomeInDownloadedList[accession] = true
}

/** Register intercepts for one or more fixture genomes (catalog, loaded, load, delete). */
export function stubGenomesFromFixtures(accessions: string[]) {
  Object.keys(fixtureRegistry).forEach((k) => delete fixtureRegistry[k])
  Object.keys(genomeInDownloadedList).forEach((k) => delete genomeInDownloadedList[k])
  accessions.forEach((a) => {
    genomeInDownloadedList[a] = false
  })

  registerGenomeIntercepts()
  return loadFixturesIntoRegistry(accessions, 0)
}

/** Register intercepts for a single fixture genome. */
export function stubGenomeFromFixture(accession: string) {
  return stubGenomesFromFixtures([accession])
}

declare global {
  namespace Cypress {
    interface Chainable {
      stubGenomeFromFixture(accession: string): Chainable<void>
      stubGenomesFromFixtures(accessions: string[]): Chainable<void>
      seedDownloadedGenome(accession: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('stubGenomeFromFixture', (accession: string) => {
  return stubGenomeFromFixture(accession)
})

Cypress.Commands.add('stubGenomesFromFixtures', (accessions: string[]) => {
  return stubGenomesFromFixtures(accessions)
})

Cypress.Commands.add('seedDownloadedGenome', (accession: string) => {
  seedDownloadedGenome(accession)
})
