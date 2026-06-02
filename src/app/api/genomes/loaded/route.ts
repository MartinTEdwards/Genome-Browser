import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const all = searchParams.get('all') === 'true'

    if (all) {
      const genomes = await prisma.genome.findMany({
        select: { accession: true, organism: true, totalGenes: true },
        orderBy: { accession: 'asc' },
      })
      return NextResponse.json({
        genomes: genomes.map((g) => ({
          accession: g.accession,
          organism: g.organism,
          totalGenes: g.totalGenes,
        })),
        loadedAccessions: genomes.map((g) => g.accession),
        total: genomes.length,
      })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const pageSize = Math.min(25, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)))
    const skip = (page - 1) * pageSize

    const [total, genomes] = await Promise.all([
      prisma.genome.count(),
      prisma.genome.findMany({
        select: { accession: true, organism: true, totalGenes: true },
        orderBy: { accession: 'asc' },
        skip,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      genomes: genomes.map((g) => ({
        accession: g.accession,
        organism: g.organism,
        totalGenes: g.totalGenes,
      })),
      loadedAccessions: genomes.map((g) => g.accession),
      total,
      page,
      pageSize,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { genomes: [], loadedAccessions: [], total: 0, page: 1, pageSize: 25 },
      { status: 500 }
    )
  }
}
