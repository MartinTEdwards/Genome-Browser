import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const accession = searchParams.get('accession')
    const search = searchParams.get('search') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const moleculeFilter = searchParams.get('moleculeType') // 'Chromosome' | 'Plasmid' | null (=both)
    const pageSize = 100

    if (!accession) return NextResponse.json({ error: 'accession required' }, { status: 400 })

    const genome = await prisma.genome.findUnique({ where: { accession } })
    if (!genome) return NextResponse.json({ error: 'Genome not loaded yet' }, { status: 404 })

    const where = {
        genomeId: genome.id,
        ...(moleculeFilter ? { moleculeType: moleculeFilter } : {}),
        ...(search
            ? {
                OR: [
                    { geneName: { contains: search } },
                    { proteinAccession: { contains: search } },
                ],
            }
            : {}),
    }

    const [total, annotations] = await Promise.all([
        prisma.geneAnnotation.count({ where }),
        prisma.geneAnnotation.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: [{ moleculeType: 'asc' }, { startCoord: 'asc' }],
        }),
    ])

    return NextResponse.json({
        organism: genome.organism,
        totalGenes: genome.totalGenes,
        total,
        page,
        pageSize,
        annotations,
    })
}
