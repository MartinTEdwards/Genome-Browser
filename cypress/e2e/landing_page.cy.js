describe("Landing page", () => {
    beforeEach(() => {
        cy.visit("/");
    })

    it("has the correct elements for new session", () => {
        cy.get('[data-cy="genome-explorer-title"]').should("be.visible").and("have.text", "Genome Explorer");
        cy.get('[data-cy="genome-explorer-subtitle"]').should("be.visible").and("have.text", "Prokaryotic genome annotation browser — Phase 2 (EC-centric)");
        cy.get('[data-cy="genome-explorer-dna-icon"]').should("be.visible");
        cy.get('[data-cy="metacyc-status"]').should("be.visible").and("have.text", "MetaCyc2GO loaded");
        cy.get('[data-cy="browser-tab-label"]').should("be.visible").and("have.text", "Browser")
        cy.get('[data-cy="directon-analysis-tab-label"]').should("be.visible").and("have.text", "Directon Analysis")
        cy.get('[data-cy="genome-selector-pane"]').should("be.visible");
        cy.get('[data-cy="genome-selector-pane-title"]').should("be.visible").and("have.text","Select Genome");
        cy.get('[data-cy="select-organism-text"]').should("be.visible").and("have.text","— Select an organism —");
        cy.get('[data-cy="load-genome-status"]').should("be.visible").and("have.text","Load Genome");
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