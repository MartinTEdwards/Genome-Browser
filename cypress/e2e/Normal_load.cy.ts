describe("UI that loads regardless of test cases", () => {
  it("displays all available genomes from ncbi", () => {
    cy.stubGenomeFromFixture('GCF_000195955.2')
    cy.visit("/");
  })
})