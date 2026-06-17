describe("Genome Summary", () => {
    beforeEach(() => {
        cy.stubGenomeFromFixture('GCF_000195955.2')
        cy.visit('/')
        cy.seedDownloadedGenome('GCF_000195955.2')
        cy.get('[data-cy="genome-summary-tab-label"]').click()
        cy.wait('@loadedGenomes')
      })

    it("has the correct UI elements for new session", () => {
        cy.get('[data-cy="genome-explorer-title"]').should("be.visible").and("have.text", "Genome Explorer");
        cy.get('[data-cy="genome-explorer-subtitle"]').should("be.visible").and("have.text", "Prokaryotic genome annotation browser — Phase 2 (EC-centric)");
        cy.get('[data-cy="genome-explorer-dna-icon"]').should("be.visible");
        cy.get('[data-cy="metacyc-status"]').should("be.visible").and("have.text", "MetaCyc2GO loaded");
        cy.get('[data-cy="genome-summary-tab-label"]').should("be.visible").and("have.text", "Genome Summary")
        cy.get('[data-cy="directon-analysis-tab-label"]').should("be.visible").and("have.text", "Directon Analysis")
        cy.get('[data-cy="genome-selector-pane"]').should("be.visible");
        cy.get('[data-cy="genome-selector-pane-title"]').should("be.visible").and("have.text","Select Genome");
         })

    it('can select a genome and view its genes and directons', () => {
            cy.get('[data-cy="genome-selector-pane-select"]')
              .should('not.be.disabled')
              .select('GCF_000195955.2')
            cy.wait('@annotations')
            cy.get('[data-cy="organism-column"]').should("be.visible").and("have.text", "Organism");
            cy.get('[data-cy="source-column"]').should("be.visible").and("have.text", "Source");
            cy.get('[data-cy="protein-accession-column"]').should("be.visible").and("have.text", "Protein Accession");
            cy.get('[data-cy="gene-name-column"]').should("be.visible").and("have.text", "Gene Name");
            cy.get('[data-cy="strand-column"]').should("be.visible").and("have.text", "Strand");
            cy.get('[data-cy="directon-column"]').should("be.visible").and("have.text", "Directon");
            cy.get('[data-cy="ec-number-column"]').should("be.visible").and("have.text", "EC Number");
            cy.get('[data-cy="go-column"]').should("be.visible").and("have.text", "GO");
            cy.get('[data-cy="start-column"]').should("be.visible").and("have.text", "Start");
            cy.get('[data-cy="stop-column"]').should("be.visible").and("have.text", "Stop");
            cy.get('[data-cy="intergenic-dist-column"]').should("be.visible").and("have.text", "Intergenic Dist.");
 
        })
    it("can view directon content in summary tab", () => {
        cy.get('[data-cy="genome-selector-pane-select"]')
        .should('not.be.disabled')
        .select('GCF_000195955.2')
      cy.wait('@annotations')
      cy.get('[data-cy="genome-selector-pane-select"]').find('option').should('have.length', 2)     // 1 placeholder + 1 genome
      cy.get('[data-cy="genome-option-GCF_000195955.2"]').should('contain', 'Mycobacterium tuberculosis')
      cy.get('[data-cy="genome-option-GCF_000195955.2"]').should('contain', 'GCF_000195955.2')
    })


    it('can view genes and directons in summary tab', () => {
        cy.get('[data-cy="genome-selector-pane-select"]').select('GCF_000195955.2')
        cy.wait('@annotations')

        cy.get('tbody tr').eq(0).within(() => {
            cy.get('td').eq(0).should('contain', 'Mycobacterium tuberculosis H37Rv')
            cy.get('td').eq(1).should('contain', 'Chromosome')
            cy.get('td').eq(2).should('contain', 'NP_214515.1')
            cy.get('td').eq(3).should('have.text', 'dnaA')
            cy.get('td').eq(4).should('contain', '+')
            cy.get('td').eq(5).should('contain', 'D1')
            cy.get('td').eq(8).should('contain', '1')
            cy.get('td').eq(9).should('contain', '1,524')
            cy.get('td').eq(10).should('contain', '—')
        })

        cy.get('tbody tr').eq(1).within(() => {
            cy.get('td').eq(0).should('contain', 'Mycobacterium tuberculosis H37Rv')
            cy.get('td').eq(1).should('contain', 'Chromosome')
            cy.get('td').eq(2).should('contain', 'NP_214516.1')
            cy.get('td').eq(3).should('have.text', 'dnaN')
            cy.get('td').eq(4).should('contain', '+')
            cy.get('td').eq(5).should('contain', 'D1')
            cy.get('td').eq(8).should('contain', '2,052')
            cy.get('td').eq(9).should('contain', '3,260')
            cy.get('td').eq(10).should('contain', '528')
        })


        cy.get('tbody tr').eq(9).within(() => {
            cy.get('td').eq(0).should('contain', 'Mycobacterium tuberculosis H37Rv')
            cy.get('td').eq(1).should('contain', 'Chromosome')
            cy.get('td').eq(2).should('contain', 'NP_214522.1')
            cy.get('td').eq(3).should('have.text', 'cell wall synthesis protein CwsA')
            cy.get('td').eq(4).should('contain', '-')
            cy.get('td').eq(5).should('contain', 'D2')
            cy.get('td').eq(5).should('contain', '→← Convergent')
            cy.get('td').eq(8).should('contain', '11,874')
            cy.get('td').eq(9).should('contain', '12,311')
            cy.get('td').eq(10).should('contain', '—')
        })
    })
})