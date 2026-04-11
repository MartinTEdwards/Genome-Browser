import { NextResponse } from 'next/server'
import { ingestMetaCycMapping } from '@/lib/metacyc-ingest'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/metacyc/ingest
 * Triggers ingestion of the metacyc2go mapping file into the MetaCycMapping table.
 * Idempotent: can be called multiple times (upserts).
 */
export async function POST() {
  try {
    const count = await ingestMetaCycMapping()
    return NextResponse.json({ success: true, mappingsLoaded: count })
  } catch (err) {
    console.error('MetaCyc ingestion failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * GET /api/metacyc/ingest
 * Returns current ingestion status (count of loaded mappings).
 */
export async function GET() {
  try {
    const total = await prisma.metaCycMapping.count()
    const withEC = await prisma.metaCycMapping.count({ where: { ecNumber: { not: null } } })
    return NextResponse.json({
      loaded: total > 0,
      totalMappings: total,
      mappingsWithEC: withEC,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
