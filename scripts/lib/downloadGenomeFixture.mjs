/**
 * Download a parsed genome into a Cypress JSON fixture (offline E2E).
 *
 * Prerequisites (one-time, requires network):
 *   1. npm run dev  (http://localhost:3000)
 *   2. MetaCyc loaded (open app once or POST /api/metacyc/ingest)
 *   3. npm run fixture:genome
 *
 * Output: cypress/fixtures/<accession>.json (default sample: 100 genes)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

const DEFAULT_ACCESSION = 'GCF_000195955.2'
const DEFAULT_ORGANISM = 'Mycobacterium tuberculosis H37Rv'

function loadDatabaseUrl() {
  const envPath = path.join(REPO_ROOT, '.env')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (key === 'DATABASE_URL') process.env.DATABASE_URL = val
    }
  }
  if (!process.env.DATABASE_URL) {
    const dbPath = path.join(REPO_ROOT, 'prisma', 'dev.db').replace(/\\/g, '/')
    process.env.DATABASE_URL = `file:${dbPath}`
  }
}

function toAnnotationRow(row, syntheticId) {
  const { genomeId: _genomeId, id: _id, ...rest } = row
  return { id: syntheticId, ...rest }
}

/**
 * @param {object} options
 * @param {string} [options.accession]
 * @param {string} [options.organismName]
 * @param {string} [options.baseUrl]
 * @param {string} [options.outDir]
 * @param {number} [options.sampleSize]
 * @returns {Promise<{ outPath: string; totalGenes: number; sampleSize: number }>}
 */
export async function downloadGenomeFixture(options = {}) {
  const accession = options.accession ?? DEFAULT_ACCESSION
  const organismName = options.organismName ?? DEFAULT_ORGANISM
  const baseUrl = options.baseUrl ?? 'http://localhost:3000'
  const outDir =
    options.outDir ?? path.join(REPO_ROOT, 'cypress', 'fixtures')
  const sampleSize = options.sampleSize ?? 100

  loadDatabaseUrl()

  const loadRes = await fetch(`${baseUrl}/api/genomes/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accession, organismName }),
  })
  const loadBody = await loadRes.text()
  if (!loadRes.ok) {
    throw new Error(
      `POST /api/genomes/load failed (${loadRes.status}): ${loadBody}\n` +
        'Is the dev server running? (npm run dev)'
    )
  }

  const prisma = new PrismaClient()
  try {
    const genome = await prisma.genome.findUnique({ where: { accession } })
    if (!genome) {
      throw new Error(`Genome ${accession} not found in DB after load`)
    }

    const rows = await prisma.geneAnnotation.findMany({
      where: { genomeId: genome.id },
      orderBy: [{ moleculeType: 'asc' }, { startCoord: 'asc' }],
      take: sampleSize,
    })

    const genes = rows.map(({ genomeId: _g, id: _id, ...g }) => g)
    const annotations = rows.map((row, i) => toAnnotationRow(row, i + 1))

    const fixture = {
      accession: genome.accession,
      organism: genome.organism,
      totalGenes: genome.totalGenes,
      sampleSize: annotations.length,
      genes,
      annotationsPage1: {
        organism: genome.organism,
        totalGenes: genome.totalGenes,
        total: annotations.length,
        page: 1,
        pageSize: 100,
        annotations,
      },
      loadedListEntry: {
        accession: genome.accession,
        organism: genome.organism,
        totalGenes: genome.totalGenes,
      },
      loadResponse: JSON.parse(loadBody),
    }

    fs.mkdirSync(outDir, { recursive: true })
    const outPath = path.join(outDir, `${accession}.json`)
    fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2), 'utf8')

    return {
      outPath,
      totalGenes: genome.totalGenes,
      sampleSize: annotations.length,
    }
  } finally {
    await prisma.$disconnect()
  }
}
