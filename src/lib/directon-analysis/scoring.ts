/**
 * Log-space combinations to avoid overflow: C(n,k) = exp(ln(n!)-ln(k!)-ln((n-k)!))
 */
function lnFactorial(n: number): number {
  if (n <= 1) return 0
  let sum = 0
  for (let i = 2; i <= n; i++) sum += Math.log(i)
  return sum
}

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  return Math.exp(lnFactorial(n) - lnFactorial(k) - lnFactorial(n - k))
}

export class ScoringEngine {
  /**
   * Overlap Coefficient: Good for finding if a directon
   * contains a smaller "sentence" found elsewhere.
   */
  static overlapCoefficient(setA: Set<string>, setB: Set<string>): number {
    const intersection = new Set([...setA].filter((x) => setB.has(x)))
    const minSize = Math.min(setA.size, setB.size)
    return minSize === 0 ? 0 : intersection.size / minSize
  }

  /**
   * Hypergeometric P-Value
   * N: Universe size (Total unique COGs)
   * M: Size of Directon A
   * n: Size of Directon B
   * k: Size of intersection
   */
  static calculatePValue(N: number, M: number, n: number, k: number): number {
    if (k > Math.min(M, n) || N <= 0) return 1
    let pValue = 0
    for (let i = k; i <= Math.min(M, n); i++) {
      const prob =
        (combinations(M, i) * combinations(N - M, n - i)) / combinations(N, n)
      pValue += prob
    }
    return Math.min(1, pValue)
  }
}

export class AdvancedScoring {
  /**
   * Calculates the 'Significance Score' of a shared set of COGs.
   * Rare genes push the score higher (lower p-value).
   */
  static calculateWeightedScore(
    sharedCogs: string[],
    freqMap: Map<string, number>
  ): number {
    let totalIC = 0
    for (const cog of sharedCogs) {
      const frequency = freqMap.get(cog) ?? 0.0001
      totalIC += -Math.log2(frequency)
    }
    return totalIC
  }
}
