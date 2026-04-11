export type EC_ID = string

export interface Directon {
  id: string
  genomeId: string
  genomeAccession: string
  moleculeType: string
  strand: '+' | '-'
  directonId: number
  genes: Set<EC_ID>
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
  sharedECs: EC_ID[]
  pValue: number
  score: number
}

export interface SentencePartition {
  genes: Set<EC_ID>
  confidence: number
}
