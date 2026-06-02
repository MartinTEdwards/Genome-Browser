import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const NCBI_BASE =
  'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/taxon/2/dataset_report'

function mapReport(r: Record<string, unknown>) {
  const assemblyInfo = r.assembly_info as Record<string, unknown> | undefined
  const organism = r.organism as Record<string, unknown> | undefined
  return {
    accession: r.accession as string,
    organismName: (organism?.organism_name as string) ?? 'Unknown',
    strain:
      (organism?.infraspecific_names as Record<string, string> | undefined)?.strain ?? '',
    assemblyName: (assemblyInfo?.assembly_name as string) ?? '',
    totalGenes:
      (r.annotation_info as Record<string, unknown> | undefined)?.total_gene_count ?? 0,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const pageToken = searchParams.get('pageToken') ?? ''
    const pageSize = Math.min(25, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)))

    const url = new URL(NCBI_BASE)
    url.searchParams.set('filters.reference_only', 'true')
    url.searchParams.set('page_size', String(pageSize))
    if (pageToken) url.searchParams.set('page_token', pageToken)

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`NCBI API error: ${res.status}`)
    const data = await res.json()

    const genomes = (data.reports ?? []).map((r: Record<string, unknown>) => mapReport(r))
    const nextPageToken = (data.next_page_token as string) || undefined

    return NextResponse.json({ genomes, pageSize, nextPageToken })
  } catch (err) {
    console.error(err)
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause : null
    const causeCode =
      cause && 'code' in cause ? String((cause as NodeJS.ErrnoException).code) : undefined
    return NextResponse.json(
      {
        error: 'Failed to fetch genomes from NCBI',
        ...(causeCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
          ? { hint: 'TLS verification failed. Run via npm run dev (uses node --use-system-ca).' }
          : {}),
      },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const accessions = body?.accessions
    if (!Array.isArray(accessions) || accessions.length === 0) {
      return NextResponse.json({ error: 'accessions array required' }, { status: 400 })
    }

    const deleted: string[] = []
    const failed: { accession: string; error: string }[] = []

    for (const accession of accessions as string[]) {
      try {
        const genome = await prisma.genome.findUnique({ where: { accession } })
        if (!genome) {
          failed.push({ accession, error: 'Not found' })
          continue
        }
        await prisma.geneAnnotation.deleteMany({ where: { genomeId: genome.id } })
        await prisma.genome.delete({ where: { id: genome.id } })
        deleted.push(accession)
      } catch (e) {
        failed.push({
          accession,
          error: e instanceof Error ? e.message : 'Delete failed',
        })
      }
    }

    return NextResponse.json({ deleted, failed })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete genomes' }, { status: 500 })
  }
}
