const THREE = ['GCF_000005845.2', 'GCF_000009045.1', 'GCF_000195955.2'] as const

function downloadedList() {
  return cy.contains('Downloaded genomes').parent().find('ul li')
}

function selectAllCatalogCheckboxes() {
  cy.wait('@catalogGenomes')
  cy.contains('Available prokaryotic genomes')
    .parent()
    .find('input[type="checkbox"]')
    .check()
}

function downloadAllCatalogSelections() {
  cy.contains('button', 'Download').click()
  cy.wait('@loadGenome')
  cy.wait('@loadGenome')
  cy.wait('@loadGenome')
  cy.wait('@loadedGenomes')
}

describe('Genome Management page', () => {
  describe('single fixture catalog', () => {
    beforeEach(() => {
      cy.stubGenomeFromFixture('GCF_000195955.2')
      cy.visit('/')
    })

    it('can load genome and display annotations', () => {
      cy.get('[data-cy="genome-cataloglist"]').contains('GCF_000195955.2').should('be.visible')
      cy.get('[data-cy="genome-catalog-item"]').should('be.visible')
    })
  })

  describe('multi-genome downloaded list', () => {
    beforeEach(() => {
      cy.stubGenomesFromFixtures([...THREE])
      cy.visit('/')
    })

    it('shows three downloaded rows after batch download', () => {
      selectAllCatalogCheckboxes()
      downloadAllCatalogSelections()
      downloadedList().should('have.length', 3)
      downloadedList().eq(0).should('contain', 'GCF_000005845.2')
      downloadedList().eq(1).should('contain', 'GCF_000009045.1')
      downloadedList().eq(2).should('contain', 'GCF_000195955.2')
    })

    it('deletes only the middle downloaded genome by list index', () => {
      selectAllCatalogCheckboxes()
      downloadAllCatalogSelections()
      downloadedList().eq(1).find('input[type="checkbox"]').check()
      cy.get('[data-cy="delete-genomes-button"]').click()
      cy.wait('@deleteGenomes')
      cy.wait('@loadedGenomes')
      downloadedList().should('have.length', 2)
      downloadedList().eq(0).should('contain', 'GCF_000005845.2')
      downloadedList().eq(1).should('contain', 'GCF_000195955.2')
      downloadedList().should('not.contain', 'GCF_000009045.1')
    })

    it('select all and delete clears the downloaded list', () => {
      selectAllCatalogCheckboxes()
      downloadAllCatalogSelections()
      cy.get('[data-cy="select-all-delete-button"]').click()
      cy.get('[data-cy="delete-genomes-button"]').click()
      cy.wait('@deleteGenomes')
      cy.contains('No genomes downloaded yet.').should('be.visible')
    })
  })
})
