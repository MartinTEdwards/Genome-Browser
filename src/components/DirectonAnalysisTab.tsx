'use client'

import { useState } from 'react'
import { Database, Loader2, BarChart3 } from 'lucide-react'
import { DirectonAnalyzer, type Genome, type Directon, type AnalysisResult } from '@/lib/directon-analysis'
import { DirectonVisualizer, type DirectonWithPartitions, type GenomeDirecton } from '@/components/directon-viz'

interface GenomeOption {
  accession: string
  organismName: string
  strain: string
  assemblyName: string
  totalGenes: number | string
}

interface DirectonAnalysisTabProps {
  genomes: GenomeOption[]
  loadedAccessions: Set<string>
  onCorpusLoaded: (accession: string) => void
}

export function DirectonAnalysisTab({
  genomes,
  loadedAccessions,
  onCorpusLoaded,
}: DirectonAnalysisTabProps) {
  const [loadingCorpus, setLoadingCorpus] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [corpusProgress, setCorpusProgress] = useState({ current: 0, total: 0 })
  const [analysisError, setAnalysisError] = useState('')
  const [results, setResults] = useState<Map<string, AnalysisResult> | null>(null)
  const [summary, setSummary] = useState<{ totalDirectons: number; multiOperon: number } | null>(null)
  const [genomeList, setGenomeList] = useState<Genome[] | null>(null)

  const handleLoadCorpus = async () => {
    if (genomes.length === 0) return
    setLoadingCorpus(true)
    setAnalysisError('')
    setResults(null)
    setSummary(null)
    const total = genomes.length
    setCorpusProgress({ current: 0, total })
    let loaded = 0
    for (const g of genomes) {
      try {
        const res = await fetch('/api/genomes/load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accession: g.accession,
            organismName: g.organismName + (g.strain ? ` (${g.strain})` : ''),
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          console.warn(`Failed to load ${g.accession}:`, err)
        } else {
          onCorpusLoaded(g.accession)
        }
      } catch (e) {
        console.warn(`Failed to load ${g.accession}:`, e)
      }
      loaded++
      setCorpusProgress({ current: loaded, total })
    }
    setLoadingCorpus(false)
  }

  const handleRunAnalysis = async () => {
    setLoadingAnalysis(true)
    setAnalysisError('')
    try {
      const res = await fetch('/api/directons')
      if (!res.ok) throw new Error('Failed to fetch directons')
      const data = await res.json()
      const rawGenomes = data.genomes ?? []

      const genomeList: Genome[] = rawGenomes.map(
        (g: { id: string; accession: string; organism: string; directons: Array<{ id: string; genomeId: string; genomeAccession: string; moleculeType: string; strand: string; directonId: number; genes: string[]; size: number }> }) => ({
          id: g.id,
          accession: g.accession,
          organism: g.organism,
          directons: g.directons.map(
            (d: { id: string; genomeId: string; genomeAccession: string; moleculeType: string; strand: string; directonId: number; genes: string[]; size: number }) =>
              ({
                id: d.id,
                genomeId: d.genomeId,
                genomeAccession: d.genomeAccession,
                moleculeType: d.moleculeType,
                strand: d.strand as '+' | '-',
                directonId: d.directonId,
                genes: new Set(d.genes),
                size: d.size,
              } satisfies Directon)
          ),
        })
      )

      setGenomeList(genomeList)

      const analyzer = new DirectonAnalyzer(genomeList)
      const resultMap = analyzer.analyze()

      let multiOperon = 0
      for (const [, r] of resultMap) {
        if (r.partitions.length > 1) multiOperon++
      }

      setResults(resultMap)
      setSummary({
        totalDirectons: resultMap.size,
        multiOperon,
      })
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : 'Analysis failed')
      setResults(null)
      setSummary(null)
      setGenomeList(null)
    } finally {
      setLoadingAnalysis(false)
    }
  }

  const corpusReady = loadedAccessions.size > 0

  return (
    <section className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
        Directon Analysis
      </h2>
      <p className="text-sm text-gray-500">
        Load all genomes from the Browser tab, then run pairwise directon comparison to detect
        multi-operon directons (functional sentences).
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleLoadCorpus}
          disabled={genomes.length === 0 || loadingCorpus}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
        >
          {loadingCorpus ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading {corpusProgress.current}/{corpusProgress.total}…
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              Load Corpus
            </>
          )}
        </button>
        <button
          onClick={handleRunAnalysis}
          disabled={!corpusReady || loadingAnalysis}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
        >
          {loadingAnalysis ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running analysis…
            </>
          ) : (
            <>
              <BarChart3 className="w-4 h-4" />
              Run Analysis
            </>
          )}
        </button>
      </div>

      {loadingCorpus && corpusProgress.total > 0 && (
        <div className="text-xs text-gray-500">
          Loaded {loadedAccessions.size} of {corpusProgress.total} genomes.
        </div>
      )}

      {corpusReady && !loadingCorpus && (
        <div className="text-xs text-emerald-400">
          Corpus: {loadedAccessions.size} genome{loadedAccessions.size !== 1 ? 's' : ''} loaded.
        </div>
      )}

      {analysisError && (
        <div className="bg-red-950/60 border border-red-700 text-red-300 rounded-xl px-5 py-3 text-sm">
          {analysisError}
        </div>
      )}

      {summary && (
        <div className="bg-gray-800/50 rounded-xl p-4 text-sm">
          <div className="flex gap-6">
            <span>
              Total directons: <span className="text-emerald-400 font-semibold">{summary.totalDirectons}</span>
            </span>
            <span>
              Multi-operon (≥2 sentences): <span className="text-cyan-400 font-semibold">{summary.multiOperon}</span>
            </span>
          </div>
        </div>
      )}

      {results && genomeList && results.size > 0 && (() => {
        const directonsForViz: DirectonWithPartitions[] = []
        const allGenomeDirectons: GenomeDirecton[] = []
        const directonIdToTarget = new Map<string, { genomeAccession: string; organism: string }>()

        for (const g of genomeList) {
          for (const d of g.directons) {
            const genesArr = Array.from(d.genes)
            allGenomeDirectons.push({
              genomeAccession: d.genomeAccession,
              organism: g.organism,
              genes: d.genes,
            })
            directonIdToTarget.set(d.id, { genomeAccession: d.genomeAccession, organism: g.organism })
            const r = results.get(d.id)
            if (r && r.partitions.length > 1) {
              directonsForViz.push({
                id: d.id,
                genomeId: d.genomeId,
                genomeAccession: d.genomeAccession,
                organism: g.organism,
                moleculeType: d.moleculeType,
                strand: d.strand,
                genes: genesArr,
                partitions: r.partitions,
                matches: r.matches,
              })
            }
          }
        }

        return (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase">
              Directons with multiple inferred operons
            </h3>
            {directonsForViz.length > 0 ? (
              <DirectonVisualizer
                directons={directonsForViz}
                allGenomeDirectons={allGenomeDirectons}
                directonIdToTarget={directonIdToTarget}
                width={780}
              />
            ) : (
              <div className="text-sm text-gray-500">No directons with multiple inferred operons found.</div>
            )}
          </div>
        )
      })()}

    </section>
  )
}
