import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildGoToEcMap, resolveGoToEC } from '@/lib/metacyc-ingest'

const NCBI_BASE = 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha'

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
    goTerms: string
    ecNumber: string | null
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

/** Collect unique GO IDs from NCBI gene_ontology / geneOntology blocks. */
function extractGoIdsFromGene(gene: unknown): string[] {
    const terms = new Set<string>()
    const g = gene as Record<string, unknown> | null
    if (!g || typeof g !== 'object') return []
    const go = (g.gene_ontology ?? g.geneOntology) as Record<string, unknown> | undefined
    if (!go || typeof go !== 'object') return []
    const keys = [
        'molecular_functions',
        'molecularFunctions',
        'biological_processes',
        'biologicalProcesses',
        'cellular_components',
        'cellularComponents',
    ] as const
    for (const key of keys) {
        const list = go[key] as Array<{ go_id?: string; goId?: string }> | undefined
        for (const item of list ?? []) {
            const id = item?.go_id ?? item?.goId
            if (id) terms.add(id)
        }
    }
    return [...terms].sort()
}

/** Report keys that map a bulk gene response row back to protein accessions. */
function reportAccessionsForGoMap(report: Record<string, unknown>): string[] {
    const keys: string[] = []
    const q = report.query
    if (Array.isArray(q)) {
        for (const x of q) {
            if (typeof x === 'string') keys.push(x)
            else if (x && typeof x === 'object' && 'accession_version' in x) {
                const av = (x as { accession_version?: string }).accession_version
                if (av) keys.push(av)
            }
        }
    } else if (typeof q === 'string') {
        keys.push(q)
    }
    if (keys.length === 0 && report.gene && typeof report.gene === 'object') {
        const proteins = (report.gene as { proteins?: Array<{ accession_version?: string }> }).proteins
        for (const p of proteins ?? []) {
            if (p.accession_version) keys.push(p.accession_version)
        }
    }
    return keys
}

/**
 * Fetch GO term IDs per protein accession from NCBI Datasets gene-by-accession API.
 * Batches requests to limit URL length; failures are best-effort (empty map entries).
 */
async function fetchGoMap(proteinAccessions: string[]): Promise<Record<string, string[]>> {
    const merged = new Map<string, Set<string>>()
    const unique = [...new Set(proteinAccessions.filter(Boolean))]
    const batchSize = 45

    for (let i = 0; i < unique.length; i += batchSize) {
        const batch = unique.slice(i, i + batchSize)
        const pathSegment = batch.map((id) => encodeURIComponent(id)).join(',')
        try {
            const res = await fetch(`${NCBI_BASE}/gene/accession/${pathSegment}`, {
                headers: { Accept: 'application/json' },
            })
            if (!res.ok) continue
            const data = (await res.json()) as { reports?: Array<Record<string, unknown>> }
            for (const report of data.reports ?? []) {
                const ids = extractGoIdsFromGene(report.gene)
                if (ids.length === 0) continue
                for (const acc of reportAccessionsForGoMap(report)) {
                    let set = merged.get(acc)
                    if (!set) {
                        set = new Set<string>()
                        merged.set(acc, set)
                    }
                    for (const id of ids) set.add(id)
                }
            }
        } catch {
            /* best-effort */
        }
        await new Promise((r) => setTimeout(r, 80))
    }

    return Object.fromEntries(
        [...merged.entries()].map(([acc, set]) => [acc, [...set].sort()])
    )
}

/**
 * Attach GO terms and resolve EC numbers from the MetaCycMapping lookup table.
 */
function attachGoAndEc(
    genes: Omit<AnnotatedGene, 'goTerms' | 'ecNumber'>[],
    goMap: Record<string, string[]>,
    goToEcMap: Map<string, string>
): AnnotatedGene[] {
    return genes.map((g) => {
        const goIds = goMap[g.proteinAccession] ?? []
        return {
            ...g,
            goTerms: JSON.stringify(goIds),
            ecNumber: resolveGoToEC(goIds, goToEcMap),
        }
    })
}

/**
 * Single-pass annotation: assign directon IDs, boundary types, and intergenic
 * distances. Sorted by startCoord within each molecule type.
 * Convergent = +→−  |  Divergent = −→+
 *
 * Phase 2: COG fields are set to null; EC resolution happens after this step.
 */
function annotateGenes(
    genes: RawGene[]
): Omit<AnnotatedGene, 'goTerms' | 'ecNumber'>[] {
    const byMolecule: Record<string, RawGene[]> = {}
    for (const g of genes) {
        if (!byMolecule[g.moleculeType]) byMolecule[g.moleculeType] = []
        byMolecule[g.moleculeType].push(g)
    }

    const molOrder = (m: string) => (m === 'Chromosome' ? 0 : m === 'Plasmid' ? 1 : 2)
    const result: Omit<AnnotatedGene, 'goTerms' | 'ecNumber'>[] = []

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

            result.push({
                ...gene,
                directonId,
                boundaryType,
                intergenicDistance,
                cogId: null,
                cogCategory: null,
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

        // Fetch molecule types in parallel with building the EC lookup map
        const [moleculeTypeMap, goToEcMap] = await Promise.all([
            fetchMoleculeTypeMap(accession),
            buildGoToEcMap(),
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

                const moleculeType = moleculeTypeMap[seqAcc] ?? 'Unknown'
                if (moleculeType === 'Plasmid') continue

                rawGenes.push({
                    proteinAccession: protein?.accession_version ?? g.locus_tag ?? '',
                    geneName: g.symbol ?? g.name ?? g.locus_tag ?? '',
                    sequenceAccession: seqAcc,
                    moleculeType,
                    strand: range?.orientation === 'minus' ? '-' : '+',
                    startCoord: range?.begin ? parseInt(range.begin, 10) : 0,
                    stopCoord: range?.end ? parseInt(range.end, 10) : 0,
                })
            }
            pageToken = data.next_page_token
        } while (pageToken && pageNum < 50)

        // Fetch GO terms, then annotate with directon info and resolve EC numbers
        const goMap = await fetchGoMap(rawGenes.map((g) => g.proteinAccession))
        const annotated = annotateGenes(rawGenes)
        const genes = attachGoAndEc(annotated, goMap, goToEcMap)

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
