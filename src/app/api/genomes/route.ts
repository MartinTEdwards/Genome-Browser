import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const res = await fetch(
            'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/taxon/2/dataset_report?filters.reference_only=true&page_size=20',
            { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } }
        )
        if (!res.ok) throw new Error(`NCBI API error: ${res.status}`)
        const data = await res.json()

        const genomes = (data.reports ?? []).map((r: Record<string, unknown>) => {
            const assemblyInfo = r.assembly_info as Record<string, unknown> | undefined
            const organism = r.organism as Record<string, unknown> | undefined
            return {
                accession: r.accession as string,
                organismName: (organism?.organism_name as string) ?? 'Unknown',
                strain: (organism?.infraspecific_names as Record<string, string> | undefined)?.strain ?? '',
                assemblyName: (assemblyInfo?.assembly_name as string) ?? '',
                totalGenes: (r.annotation_info as Record<string, unknown> | undefined)?.total_gene_count ?? 0,
            }
        })

        return NextResponse.json({ genomes })
    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: 'Failed to fetch genomes from NCBI' }, { status: 500 })
    }
}
