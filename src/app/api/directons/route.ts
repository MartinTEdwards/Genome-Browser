import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const annotations = await prisma.geneAnnotation.findMany({
      where: { moleculeType: { not: 'Plasmid' } },
      select: {
        genomeId: true,
        sequenceAccession: true,
        moleculeType: true,
        strand: true,
        directonId: true,
        ecNumber: true,
      },
    })

    const genomeMap = new Map<
      number,
      { id: string; accession: string; organism: string }
    >()
    const genomes = await prisma.genome.findMany({
      select: { id: true, accession: true, organism: true },
    })
    for (const g of genomes) {
      genomeMap.set(g.id, {
        id: String(g.id),
        accession: g.accession,
        organism: g.organism,
      })
    }

    const directonMap = new Map<
      string,
      { genomeId: string; genomeAccession: string; organism: string; moleculeType: string; strand: string; directonId: number; ecs: Set<string> }
    >()

    for (const a of annotations) {
      const genome = genomeMap.get(a.genomeId)
      if (!genome) continue

      // Use sequenceAccession when available to differentiate replicons (chromosome vs plasmids).
      // Load route groups by moleculeType and assigns directonId per molecule; use seq to avoid
      // merging different plasmids (which share moleculeType) when sequenceAccession is set.
      const repliconKey = a.sequenceAccession ? a.sequenceAccession : `${a.moleculeType}`
      const key = `${a.genomeId}-${repliconKey}-${a.directonId}`
      let entry = directonMap.get(key)
      if (!entry) {
        entry = {
          genomeId: String(a.genomeId),
          genomeAccession: genome.accession,
          organism: genome.organism,
          moleculeType: a.moleculeType,
          strand: a.strand === '-' ? '-' : '+',
          directonId: a.directonId,
          ecs: new Set(),
        }
        directonMap.set(key, entry)
      }
      // Phase 2: aggregate EC numbers instead of COG IDs
      if (a.ecNumber) entry.ecs.add(a.ecNumber)
    }

    const genomeList: Array<{
      id: string
      accession: string
      organism: string
      directons: Array<{
        id: string
        genomeId: string
        genomeAccession: string
        moleculeType: string
        strand: '+' | '-'
        directonId: number
        genes: string[]
        size: number
      }>
    }> = []

    const byGenome = new Map<string, Array<{ id: string; genomeId: string; genomeAccession: string; moleculeType: string; strand: '+' | '-'; directonId: number; genes: string[]; size: number }>>()
    for (const [key, entry] of directonMap) {
      const directon = {
        id: key,
        genomeId: entry.genomeId,
        genomeAccession: entry.genomeAccession,
        moleculeType: entry.moleculeType,
        strand: entry.strand as '+' | '-',
        directonId: entry.directonId,
        genes: Array.from(entry.ecs),
        size: entry.ecs.size,
      }
      const list = byGenome.get(entry.genomeId) ?? []
      list.push(directon)
      byGenome.set(entry.genomeId, list)
    }

    for (const g of genomes) {
      const dirs = byGenome.get(String(g.id)) ?? []
      // Only include genomes that have directons (i.e. loaded with annotations)
      if (dirs.length > 0) {
        genomeList.push({
          id: String(g.id),
          accession: g.accession,
          organism: g.organism,
          directons: dirs,
        })
      }
    }

    return NextResponse.json({ genomes: genomeList })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
