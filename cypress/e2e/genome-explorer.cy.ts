describe('Genome Explorer', () => {
  it('loads the home page', () => {
    cy.visit('/')
    cy.contains('Genome Explorer').should('be.visible')
  })

  it('shows genome selector and Load Genome button', () => {
    cy.visit('/')
    cy.contains('Select Genome').should('be.visible')
    cy.contains('Load Genome').should('be.visible')
  })

  // Use Cypress Studio (Edit in Studio) to record: select genome, click Load Genome, verify table.
  // Or use cy.prompt() with Cypress Cloud for AI-generated steps.
})
