describe('Genome Summary (offline)', () => {
  beforeEach(() => {
    cy.stubGenomeFromFixture('GCF_000195955.2')
    cy.visit('/')
    cy.contains('Genome Summary').click()
  })

  it('shows annotations for the fixture genome', () => {
    cy.get('select').select('GCF_000195955.2')
    cy.wait('@annotations')
    cy.contains('dnaA').should('be.visible')
    cy.contains('Total genes in DB:').should('be.visible')
  })
})