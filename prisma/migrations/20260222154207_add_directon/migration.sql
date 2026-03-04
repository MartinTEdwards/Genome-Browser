-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GeneAnnotation" (
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
    CONSTRAINT "GeneAnnotation_genomeId_fkey" FOREIGN KEY ("genomeId") REFERENCES "Genome" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GeneAnnotation" ("geneName", "genomeId", "id", "intergenicDistance", "moleculeType", "proteinAccession", "sequenceAccession", "startCoord", "stopCoord", "strand") SELECT "geneName", "genomeId", "id", "intergenicDistance", "moleculeType", "proteinAccession", "sequenceAccession", "startCoord", "stopCoord", "strand" FROM "GeneAnnotation";
DROP TABLE "GeneAnnotation";
ALTER TABLE "new_GeneAnnotation" RENAME TO "GeneAnnotation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
