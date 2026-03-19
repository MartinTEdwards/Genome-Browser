export type COG_ID = string

export interface Directon {
  id: string
  genomeId: string
  genomeAccession: string
  moleculeType: string
  strand: '+' | '-'
  directonId: number
  genes: Set<COG_ID>
  size: number
}

export interface Genome {
  id: string
  accession: string
  organism: string
  directons: Directon[]
}

export interface ComparisonResult {
  sourceId: string
  targetId: string
  overlapCount: number
  sharedCogs: COG_ID[]
  pValue: number
  score: number
}

export interface SentencePartition {
  genes: Set<COG_ID>
  confidence: number
}
