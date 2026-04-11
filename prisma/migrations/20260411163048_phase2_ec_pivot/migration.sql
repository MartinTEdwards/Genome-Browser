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
    "sequenceAccession" TEXT NOT NULL DEFAULT '',
    "moleculeType" TEXT NOT NULL DEFAULT 'Unknown',
    "strand" TEXT NOT NULL,
    "startCoord" INTEGER NOT NULL,
    "stopCoord" INTEGER NOT NULL,
    "intergenicDistance" INTEGER,
    "directonId" INTEGER NOT NULL DEFAULT 1,
    "boundaryType" TEXT,
    "cogId" TEXT,
    "cogCategory" TEXT,
    "goTerms" TEXT NOT NULL DEFAULT '',
    "ecNumber" TEXT,
    CONSTRAINT "GeneAnnotation_genomeId_fkey" FOREIGN KEY ("genomeId") REFERENCES "Genome" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetaCycMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "goId" TEXT NOT NULL,
    "metaCycId" TEXT NOT NULL,
    "ecNumber" TEXT,
    "goLabel" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE UNIQUE INDEX "Genome_accession_key" ON "Genome"("accession");

-- CreateIndex
CREATE UNIQUE INDEX "MetaCycMapping_goId_key" ON "MetaCycMapping"("goId");

-- CreateIndex
CREATE INDEX "MetaCycMapping_ecNumber_idx" ON "MetaCycMapping"("ecNumber");
