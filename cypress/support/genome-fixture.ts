/**
 * Stub genome APIs from a Cypress fixture (no NCBI / load network).
 * Generate fixtures with: npm run fixture:genome
 */

export interface GenomeFixture {
  accession: string
  organism: string
  totalGenes: number
  sampleSize: number
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

/** Register intercepts for loaded list, annotations, and optional load POST. */
export function stubGenomeFromFixture(accession: string) {
  cy.fixture(accession).then((raw) => {
    const fx = raw as GenomeFixture
    const loadedPayload = {
      genomes: [fx.loadedListEntry],
      loadedAccessions: [fx.accession],
      total: 1,
    }

    cy.intercept('GET', '**/api/genomes/loaded*', loadedPayload).as('loadedGenomes')
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
