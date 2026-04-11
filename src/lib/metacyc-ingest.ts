import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

/**
 * LINE STRUCTURE EXAMPLE:
 * MetaCyc:PWY-5028 > GO:tryptophan biosynthetic process ; GO:0000162
 * MetaCyc:1.1.1.117-RXN > GO:D-arabinose 1-dehydrogenase [NAD(P)+] activity ; GO:0045290
 *
 * We extract:
 *  - metaCycId: PWY-5028 or 1.1.1.117-RXN
 *  - goLabel:   the human-readable name between > GO: and ;
 *  - goId:      GO:0000162
 *  - ecNumber:  extracted from metaCycId if it matches EC pattern
 */

const EC_REGEX = /(\d+\.\d+\.\d+\.[\d-]+)/

/**
 * Extract an EC number from a MetaCyc ID string.
 * Matches standard EC patterns like 1.1.1.1 or 2.7.1.-
 */
export function extractEC(metaCycId: string): string | null {
  const match = metaCycId.match(EC_REGEX)
  return match ? match[1] : null
}

export interface MetaCycEntry {
  goId: string
  goLabel: string
  metaCycId: string
  ecNumber: string | null
}

/**
 * Parse the metacyc2go static mapping file into structured entries.
 */
export function parseMetaCycFile(filePath: string): MetaCycEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const entries: MetaCycEntry[] = []

  for (const line of lines) {
    // Skip comment headers and empty lines
    if (line.startsWith('!') || line.trim() === '') continue

    // Format: MetaCyc:ID > GO:description ; GO:NNNNNNN
    const parts = line.split(' ; ')
    const goId = parts[1]?.trim()
    if (!goId) continue

    const lhsParts = parts[0]?.split(' > ')
    if (!lhsParts || lhsParts.length < 2) continue

    const metaCycId = lhsParts[0]?.replace('MetaCyc:', '').trim()
    // Extract GO label: everything after "GO:" in the right half of >
    const goLabel = lhsParts[1]?.replace(/^GO:/, '').trim() ?? ''

    if (goId && metaCycId) {
      entries.push({
        goId,
        goLabel,
        metaCycId,
        ecNumber: extractEC(metaCycId),
      })
    }
  }

  return entries
}

/**
 * Ingest the metacyc2go mapping file into the MetaCycMapping table.
 * Returns the count of entries persisted.
 */
export async function ingestMetaCycMapping(filePath?: string): Promise<number> {
  const resolvedPath = filePath ?? path.join(process.cwd(), 'data', 'metacyc2go.txt')
  console.log(`--- Initializing MetaCyc2GO Mapping Ingestion from ${resolvedPath} ---`)

  const entries = parseMetaCycFile(resolvedPath)
  let processedCount = 0

  // Use chunked upserts for performance
  const chunkSize = 200
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map((entry) =>
        prisma.metaCycMapping.upsert({
          where: { goId: entry.goId },
          update: {
            metaCycId: entry.metaCycId,
            ecNumber: entry.ecNumber,
            goLabel: entry.goLabel,
          },
          create: {
            goId: entry.goId,
            metaCycId: entry.metaCycId,
            ecNumber: entry.ecNumber,
            goLabel: entry.goLabel,
          },
        })
      )
    )
    processedCount += chunk.length
  }

  console.log(`--- Ingestion Complete: ${processedCount} mappings persisted ---`)
  return processedCount
}

/**
 * Build an in-memory lookup map from GO IDs to EC numbers
 * using the pre-loaded MetaCycMapping table.
 */
export async function buildGoToEcMap(): Promise<Map<string, string>> {
  const mappings = await prisma.metaCycMapping.findMany({
    where: { ecNumber: { not: null } },
    select: { goId: true, ecNumber: true },
  })

  const map = new Map<string, string>()
  for (const m of mappings) {
    if (m.ecNumber) {
      map.set(m.goId, m.ecNumber)
    }
  }

  return map
}

/**
 * Resolve a set of GO IDs to the primary (first-match) EC number.
 * Uses dimensionality reduction: one EC per gene.
 */
export function resolveGoToEC(
  goIds: string[],
  goToEcMap: Map<string, string>
): string | null {
  for (const goId of goIds) {
    const ec = goToEcMap.get(goId)
    if (ec) return ec
  }
  return null
}
