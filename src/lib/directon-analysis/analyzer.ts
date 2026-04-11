import type { ComparisonResult, Directon, Genome } from './types'
import { ScoringEngine } from './scoring'
import { DirectonDeconvoluter } from './deconvoluter'

const MIN_OVERLAP = 2
const P_VALUE_THRESHOLD = 0.001

export interface AnalysisResult {
  directonId: string
  matches: ComparisonResult[]
  partitions: Set<string>[]
}

export class DirectonAnalyzer {
  private universeSize: number
  private directons: Directon[]

  constructor(genomes: Genome[]) {
    const allECs = new Set<string>()
    for (const g of genomes) {
      for (const d of g.directons) {
        for (const ec of d.genes) allECs.add(ec)
      }
    }
    this.universeSize = allECs.size
    this.directons = genomes.flatMap((g) => g.directons)
  }

  analyze(): Map<string, AnalysisResult> {
    const results = new Map<string, AnalysisResult>()

    for (const d1 of this.directons) {
      const matchingSentences: ComparisonResult[] = []

      for (const d2 of this.directons) {
        if (d1.id === d2.id) continue
        if (d1.genomeId === d2.genomeId) continue

        const intersection = [...d1.genes].filter((g) => d2.genes.has(g))

        if (intersection.length >= MIN_OVERLAP) {
          const pVal = ScoringEngine.calculatePValue(
            this.universeSize,
            d1.size,
            d2.size,
            intersection.length
          )

          if (pVal < P_VALUE_THRESHOLD) {
            matchingSentences.push({
              sourceId: d1.id,
              targetId: d2.id,
              overlapCount: intersection.length,
              sharedECs: intersection,
              pValue: pVal,
              score: pVal,
            })
          }
        }
      }

      const partitions =
        matchingSentences.length > 0
          ? DirectonDeconvoluter.splitIntoSentences(d1, matchingSentences)
          : []

      results.set(d1.id, { directonId: d1.id, matches: matchingSentences, partitions })
    }

    return results
  }
}
