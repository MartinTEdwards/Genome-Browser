describe('Genome offline fixture', () => {
  beforeEach(() => {
    cy.stubGenomeFromFixture('GCF_000195955.2')
    cy.visit('/')
  })

  it('shows annotations for the fixture genome on Genome Summary', () => {
    cy.contains('Genome Summary').click()
    cy.get('select').select('GCF_000195955.2')
    cy.wait('@annotations')
    cy.contains('dnaA').should('be.visible')
    cy.contains('Total genes in DB:').should('be.visible')
  })

  it('shows only the fixture genome in the available catalog', () => {
    cy.get('[data-cy="genome-management-tab"]').click()
    cy.wait('@catalogGenomes')
    cy.contains('Mycobacterium tuberculosis H37Rv').should('be.visible')
    cy.contains('GCF_000195955.2').should('be.visible')
    cy.contains('Available prokaryotic genomes')
      .parent()
      .find('input[type="checkbox"]')
      .should('have.length', 1)
  })

  it('deletes the fixture genome from the downloaded list on Genome Management', () => {
    cy.get('[data-cy="genome-management-tab"]').click()
    cy.wait('@loadedGenomes')
    cy.contains('GCF_000195955.2').should('be.visible')
    cy.get('[data-cy="select-all-delete-button"]').click()
    cy.get('[data-cy="delete-genomes-button"]').should('be.enabled').click()
    cy.wait('@deleteGenomes')
    cy.contains('GCF_000195955.2: Not found').should('not.exist')
    cy.contains('No genomes downloaded yet.').should('be.visible')
  })
})
