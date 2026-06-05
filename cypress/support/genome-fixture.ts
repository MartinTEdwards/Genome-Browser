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

/** Register intercepts for catalog, loaded list, annotations, load POST, and delete (offline). */
export function stubGenomeFromFixture(accession: string) {
  cy.fixture(accession).then((raw) => {
    const fx = raw as GenomeFixture
    const catalogEntry = catalogEntryFromFixture(fx)
    const loadedWithGenome = {
      genomes: [fx.loadedListEntry],
      loadedAccessions: [fx.accession],
      total: 1,
      page: 1,
      pageSize: 25,
    }
    const loadedEmpty = {
      genomes: [],
      loadedAccessions: [],
      total: 0,
      page: 1,
      pageSize: 25,
    }

    let genomeDeleted = false

    cy.intercept('GET', '**/api/genomes?*', (req) => {
      const url = new URL(req.url)
      const pageToken = url.searchParams.get('pageToken')
      if (pageToken) {
        req.reply({ statusCode: 200, body: { genomes: [], pageSize: 25 } })
        return
      }
      req.reply({
        statusCode: 200,
        body: {
          genomes: [catalogEntry],
          pageSize: 25,
        },
      })
    }).as('catalogGenomes')

    cy.intercept('GET', '**/api/genomes/loaded*', (req) => {
      req.reply({
        statusCode: 200,
        body: genomeDeleted ? loadedEmpty : loadedWithGenome,
      })
    }).as('loadedGenomes')

    cy.intercept('GET', `**/api/annotations*accession=${accession}*`, fx.annotationsPage1).as(
      'annotations'
    )

    cy.intercept('POST', '**/api/genomes/load', {
      statusCode: 200,
      body: fx.loadResponse ?? {
        success: true,
        totalGenes: fx.totalGenes,
      },
    }).as('loadGenome')

    cy.intercept('DELETE', '**/api/genomes', (req) => {
      genomeDeleted = true
      req.reply({
        statusCode: 200,
        body: { deleted: [fx.accession], failed: [] },
      })
    }).as('deleteGenomes')
  })
}

declare global {
  namespace Cypress {
    interface Chainable {
      stubGenomeFromFixture(accession: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('stubGenomeFromFixture', (accession: string) => {
  stubGenomeFromFixture(accession)
})
