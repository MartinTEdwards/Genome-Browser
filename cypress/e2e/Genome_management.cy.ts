describe("Genome Management page", () => {
    beforeEach(() => {
        cy.visit("/");
    })

    it("has a disbabled Load Genome button if no organism is selected", () => {
        cy.get('[data-cy="load-genome-button"]').should("be.disabled")
    })

    it('can load genome and display annotations', () => {
        cy.contains('Select Genome').should('be.visible')
        cy.get('select').select('GCF_000195955.2')
        cy.contains('GCF_000195955.2').should('be.visible')
        cy.contains('Re-load Genome').should('be.enabled') 
        cy.intercept('GET', '/api/annotations?accession=GCF_000195955.2&search=&page=1').as('loadRequest');
        cy.wait('@loadRequest').then((interception) => {
            expect(interception?.response?.statusCode).to.eq(200)   
            })
        cy.contains('Accession:').should('be.visible')
        cy.contains('Total genes in DB:').should('be.visible')
        cy.contains('Matching:').should('be.visible')
        cy.contains('Source').should('be.visible')
        cy.contains('Protein Accession').should('be.visible')
        cy.contains('Gene Name').should('be.visible')
        cy.contains('Strand').should('be.visible')
        cy.contains('COG').should('be.visible')
        cy.contains('GO').should('be.visible')
        cy.contains('Start').should('be.visible')
        cy.contains('Stop').should('be.visible')
        cy.contains('Directon').should('be.visible')
        cy.contains('Intergenic Dist.').should('be.visible')
  })
    
})
