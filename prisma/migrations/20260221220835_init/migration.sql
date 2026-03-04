-- CreateTable
CREATE TABLE "Genome" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accession" TEXT NOT NULL,
    "organism" TEXT NOT NULL,
    "totalGenes" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "GeneAnnotation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "genomeId" INTEGER NOT NULL,
    "proteinAccession" TEXT NOT NULL,
    "geneName" TEXT NOT NULL,
    "strand" TEXT NOT NULL,
    "startCoord" INTEGER NOT NULL,
    "stopCoord" INTEGER NOT NULL,
    CONSTRAINT "GeneAnnotation_genomeId_fkey" FOREIGN KEY ("genomeId") REFERENCES "Genome" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Genome_accession_key" ON "Genome"("accession");
