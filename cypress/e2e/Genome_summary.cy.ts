describe("Genome Summary", () => {
    beforeEach(() => {
        cy.visit("/");
    })

    it("has the correct UI elements for new session", () => {
        cy.get('[data-cy="genome-summary-tab-label"]').click();
        cy.get('[data-cy="genome-explorer-title"]').should("be.visible").and("have.text", "Genome Explorer");
        cy.get('[data-cy="genome-explorer-subtitle"]').should("be.visible").and("have.text", "Prokaryotic genome annotation browser — Phase 2 (EC-centric)");
        cy.get('[data-cy="genome-explorer-dna-icon"]').should("be.visible");
        cy.get('[data-cy="metacyc-status"]').should("be.visible").and("have.text", "MetaCyc2GO loaded");
        cy.get('[data-cy="genome-summary-tab-label"]').should("be.visible").and("have.text", "Genome Summary")
        cy.get('[data-cy="directon-analysis-tab-label"]').should("be.visible").and("have.text", "Directon Analysis")
        cy.get('[data-cy="genome-selector-pane"]').should("be.visible");
        cy.get('[data-cy="genome-selector-pane-title"]').should("be.visible").and("have.text","Select Genome");
        cy.get('[data-cy="select-organism-text"]').should("be.visible").and("have.text","— No downloaded genomes —");
    })

    
})