import type { ComparisonResult, Directon } from './types'

export class DirectonDeconvoluter {
  /**
   * Partitions a directon based on functional linkage from other genomes.
   * Uses shared EC numbers from significant matches to build an adjacency
   * graph, then finds connected components via BFS.
   */
  static splitIntoSentences(
    target: Directon,
    matches: ComparisonResult[],
    _minSupport: number = 2
  ): Set<string>[] {
    const genesInTarget = Array.from(target.genes)
    const adjMatrix = new Map<string, Set<string>>()

    genesInTarget.forEach((g) => adjMatrix.set(g, new Set()))

    for (const match of matches) {
      const shared = match.sharedECs
      for (let i = 0; i < shared.length; i++) {
        for (let j = i + 1; j < shared.length; j++) {
          if (genesInTarget.includes(shared[i]) && genesInTarget.includes(shared[j])) {
            adjMatrix.get(shared[i])!.add(shared[j])
            adjMatrix.get(shared[j])!.add(shared[i])
          }
        }
      }
    }

    const visited = new Set<string>()
    const components: Set<string>[] = []

    for (const gene of genesInTarget) {
      if (!visited.has(gene)) {
        const component = new Set<string>()
        this.bfs(gene, adjMatrix, visited, component)
        if (component.size >= 1) components.push(component)
      }
    }

    return components
  }

  private static bfs(
    start: string,
    adj: Map<string, Set<string>>,
    visited: Set<string>,
    component: Set<string>
  ) {
    const queue = [start]
    visited.add(start)
    while (queue.length > 0) {
      const node = queue.shift()!
      component.add(node)
      const neighbors = adj.get(node)
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            queue.push(neighbor)
          }
        }
      }
    }
  }
}
