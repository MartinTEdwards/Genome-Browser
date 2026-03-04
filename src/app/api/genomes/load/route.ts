import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const NCBI_BASE = 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha'
const COG_API = 'https://www.ncbi.nlm.nih.gov/research/cog/api/cog'

// ── Types ──────────────────────────────────────────────────────────────────

interface NcbiAnnotation {
    symbol?: string
    name?: string
    locus_tag?: string
    genomic_regions?: Array<{
        gene_range?: { accession_version?: string; range?: Array<{ begin?: string; end?: string; orientation?: string }> }
    }>
    proteins?: Array<{ accession_version?: string }>
}

interface RawGene {
    proteinAccession: string
    geneName: string
    sequenceAccession: string
    moleculeType: string
    strand: string
    startCoord: number
    stopCoord: number
}

interface AnnotatedGene extends RawGene {
    intergenicDistance: number | null
    directonId: number
    boundaryType: string | null
    cogId: string | null
    cogCategory: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Fetch refseq_accession → moleculeType from NCBI sequence_reports */
async function fetchMoleculeTypeMap(accession: string): Promise<Record<string, string>> {
    const map: Record<string, string> = {}
    try {
        const res = await fetch(
            `${NCBI_BASE}/genome/accession/${accession}/sequence_reports?page_size=200`,
            { headers: { Accept: 'application/json' } }
        )
        if (!res.ok) return map
        for (const r of (await res.json()).reports ?? []) {
            if (r.refseq_accession && r.assigned_molecule_location_type)
                map[r.refseq_accession] = r.assigned_molecule_location_type
        }
    } catch { /* best-effort */ }
    return map
}

/**
 * Fetch all COG annotations for an assembly from the NCBI COG API.
 * Returns a map of protein accession → { cogId, cogCategory (letter) }.
 * When a protein has multiple COG hits, we keep the one with the highest bitscore.
 */
async function fetchCogMap(
    accession: string
): Promise<Record<string, { cogId: string; cogCategory: string }>> {
    const map: Record<string, { cogId: string; bitscore: number; cogCategory: string }> = {}
    let url: string | null =
        `${COG_API}/?assembly=${accession}&format=json&limit=1000`

    while (url) {
        try {
            const res = await fetch(url, { headers: { Accept: 'application/json' } })
            if (!res.ok) break
            const data = await res.json()
            for (const hit of data.results ?? []) {
                const protein: string = hit.protein?.name
                const cogId: string = hit.cog?.cogid
                const bitscore: number = hit.bitscore ?? 0
                const funccat: string = hit.cog?.funcats?.[0]?.name ?? ''
                if (!protein || !cogId) continue
                const existing = map[protein]
                if (!existing || bitscore > existing.bitscore) {
                    map[protein] = { cogId, bitscore, cogCategory: funccat }
                }
            }
            // Follow pagination using the "next" URL; but strip the internal hostname
            // that NCBI occasionally puts in the next field and replace with the public one.
            if (data.next) {
                const nextPath = data.next.replace(/^https?:\/\/[^/]+/, '')
                url = `https://www.ncbi.nlm.nih.gov${nextPath}`
            } else {
                url = null
            }
        } catch { break }
    }

    return Object.fromEntries(
        Object.entries(map).map(([k, v]) => [k, { cogId: v.cogId, cogCategory: v.cogCategory }])
    )
}

/**
 * Single-pass annotation: assign directon IDs, boundary types, and intergenic
 * distances. Sorted by startCoord within each molecule type.
 * Convergent = +→−  |  Divergent = −→+
 */
function annotateGenes(genes: RawGene[], cogMap: Record<string, { cogId: string; cogCategory: string }>): AnnotatedGene[] {
    const byMolecule: Record<string, RawGene[]> = {}
    for (const g of genes) {
        if (!byMolecule[g.moleculeType]) byMolecule[g.moleculeType] = []
        byMolecule[g.moleculeType].push(g)
    }

    const molOrder = (m: string) => (m === 'Chromosome' ? 0 : m === 'Plasmid' ? 1 : 2)
    const result: AnnotatedGene[] = []

    for (const mol of Object.keys(byMolecule).sort((a, b) => molOrder(a) - molOrder(b))) {
        const sorted = byMolecule[mol].slice().sort((a, b) => a.startCoord - b.startCoord)
        let directonId = 1
        let prevStrand: string | null = null
        let prevStopCoord: number | null = null

        for (const gene of sorted) {
            let boundaryType: string | null = null
            let intergenicDistance: number | null = null

            if (prevStrand !== null && gene.strand !== prevStrand) {
                directonId++
                boundaryType = prevStrand === '+' ? 'Convergent' : 'Divergent'
            } else if (prevStrand === gene.strand && prevStopCoord !== null) {
                intergenicDistance = gene.startCoord - prevStopCoord
            }

            const cog = cogMap[gene.proteinAccession]
            result.push({
                ...gene,
                directonId,
                boundaryType,
                intergenicDistance,
                cogId: cog?.cogId ?? null,
                cogCategory: cog?.cogCategory ?? null,
            })

            prevStrand = gene.strand
            prevStopCoord = gene.stopCoord
        }
    }
    return result
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const { accession, organismName } = await req.json()
        if (!accession) return NextResponse.json({ error: 'accession required' }, { status: 400 })

        // Fetch molecule types and COG map in parallel
        const [moleculeTypeMap, cogMap] = await Promise.all([
            fetchMoleculeTypeMap(accession),
            fetchCogMap(accession),
        ])

        const rawGenes: RawGene[] = []
        let pageToken: string | undefined
        let pageNum = 0

        do {
            pageNum++
            const url = new URL(`${NCBI_BASE}/genome/accession/${accession}/annotation_report`)
            url.searchParams.set('page_size', '1000')
            if (pageToken) url.searchParams.set('page_token', pageToken)

            const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
            if (!res.ok) throw new Error(`NCBI annotation error: ${res.status}`)
            const data = await res.json()

            for (const report of data.reports ?? []) {
                const g: NcbiAnnotation = report.annotation
                if (!g) continue
                const protein = g.proteins?.[0]
                const region = g.genomic_regions?.[0]
                const range = region?.gene_range?.range?.[0]
                const seqAcc = region?.gene_range?.accession_version ?? ''

                rawGenes.push({
                    proteinAccession: protein?.accession_version ?? g.locus_tag ?? '',
                    geneName: g.symbol ?? g.name ?? g.locus_tag ?? '',
                    sequenceAccession: seqAcc,
                    moleculeType: moleculeTypeMap[seqAcc] ?? 'Unknown',
                    strand: range?.orientation === 'minus' ? '-' : '+',
                    startCoord: range?.begin ? parseInt(range.begin, 10) : 0,
                    stopCoord: range?.end ? parseInt(range.end, 10) : 0,
                })
            }
            pageToken = data.next_page_token
        } while (pageToken && pageNum < 50)

        const genes = annotateGenes(rawGenes, cogMap)

        const genome = await prisma.genome.upsert({
            where: { accession },
            create: { accession, organism: organismName ?? accession, totalGenes: genes.length },
            update: { organism: organismName ?? accession, totalGenes: genes.length },
        })

        await prisma.geneAnnotation.deleteMany({ where: { genomeId: genome.id } })

        const chunkSize = 500
        for (let i = 0; i < genes.length; i += chunkSize) {
            await prisma.geneAnnotation.createMany({
                data: genes.slice(i, i + chunkSize).map((g) => ({ ...g, genomeId: genome.id })),
            })
        }

        return NextResponse.json({ success: true, genomeId: genome.id, totalGenes: genes.length })
    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
