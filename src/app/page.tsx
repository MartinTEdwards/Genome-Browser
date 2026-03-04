'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Database, ChevronLeft, ChevronRight, Dna, Loader2, RefreshCw } from 'lucide-react'

const COG_CATEGORIES: Record<string, string> = {
  J: 'Translation', A: 'RNA processing', K: 'Transcription', L: 'Replication/repair',
  D: 'Cell division', V: 'Defense', T: 'Signal transduction', M: 'Cell wall/membrane',
  N: 'Cell motility', U: 'Trafficking/secretion', O: 'Post-translational mod.',
  X: 'Mobilome', C: 'Energy production', G: 'Carbohydrate metabolism',
  E: 'Amino acid metabolism', F: 'Nucleotide metabolism', H: 'Coenzyme metabolism',
  I: 'Lipid metabolism', P: 'Inorganic ion transport', Q: 'Secondary metabolites',
  R: 'General function', S: 'Unknown function',
}

interface GenomeOption {
  accession: string
  organismName: string
  strain: string
  assemblyName: string
  totalGenes: number | string
}

interface Annotation {
  id: number
  proteinAccession: string
  geneName: string
  sequenceAccession: string
  moleculeType: string
  strand: string
  startCoord: number
  stopCoord: number
  intergenicDistance: number | null
  directonId: number
  boundaryType: string | null
  cogId: string | null
  cogCategory: string | null
}

interface AnnotationsResponse {
  organism: string
  totalGenes: number
  total: number
  page: number
  pageSize: number
  annotations: Annotation[]
}

export default function HomePage() {
  const [genomes, setGenomes] = useState<GenomeOption[]>([])
  const [selectedAccession, setSelectedAccession] = useState('')
  const [selectedOrganism, setSelectedOrganism] = useState('')
  const [loadingGenomes, setLoadingGenomes] = useState(false)
  const [loadingAnnotations, setLoadingAnnotations] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [annotationsData, setAnnotationsData] = useState<AnnotationsResponse | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [moleculeFilter, setMoleculeFilter] = useState<'Chromosome' | 'Plasmid' | 'Both'>('Chromosome')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  // Fetch genome list
  useEffect(() => {
    setLoadingGenomes(true)
    fetch('/api/genomes')
      .then((r) => r.json())
      .then((d) => setGenomes(d.genomes ?? []))
      .catch(() => setError('Failed to load genome list from NCBI.'))
      .finally(() => setLoadingGenomes(false))
  }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Fetch annotations whenever accession, search, or page changes
  const fetchAnnotations = useCallback(async () => {
    if (!selectedAccession) return
    setLoadingAnnotations(true)
    setError('')
    try {
      const params = new URLSearchParams({
        accession: selectedAccession,
        search: debouncedSearch,
        page: String(page),
        ...(moleculeFilter !== 'Both' ? { moleculeType: moleculeFilter } : {}),
      })
      const res = await fetch(`/api/annotations?${params}`)
      if (res.status === 404) {
        setAnnotationsData(null)
        return
      }
      if (!res.ok) throw new Error('Failed to fetch')
      setAnnotationsData(await res.json())
    } catch {
      setError('Failed to fetch annotations.')
    } finally {
      setLoadingAnnotations(false)
    }
  }, [selectedAccession, debouncedSearch, page, moleculeFilter])

  useEffect(() => {
    fetchAnnotations()
  }, [fetchAnnotations])

  const handleSelectGenome = (accession: string) => {
    const g = genomes.find((x) => x.accession === accession)
    setSelectedAccession(accession)
    setSelectedOrganism(g ? g.organismName + (g.strain ? ` (${g.strain})` : '') : accession)
    setAnnotationsData(null)
    setPage(1)
    setSearch('')
    setMoleculeFilter('Chromosome')
  }

  const handleLoadGenome = async () => {
    if (!selectedAccession) return
    setLoadingData(true)
    setError('')
    try {
      const res = await fetch('/api/genomes/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accession: selectedAccession, organismName: selectedOrganism }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      await fetchAnnotations()
    } catch (e) {
      setError(`Load failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setLoadingData(false)
    }
  }

  const isLoaded = !!annotationsData
  const totalPages = annotationsData ? Math.ceil(annotationsData.total / annotationsData.pageSize) : 1

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Dna className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Genome Explorer</h1>
            <p className="text-xs text-gray-400">Prokaryotic genome annotation browser</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Genome selector panel */}
        <section className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Select Genome</h2>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              {loadingGenomes && (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
              <select
                value={selectedAccession}
                onChange={(e) => handleSelectGenome(e.target.value)}
                disabled={loadingGenomes}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 pr-10 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                <option value="">— Select an organism —</option>
                {genomes.map((g) => (
                  <option key={g.accession} value={g.accession}>
                    {g.organismName}{g.strain ? ` (${g.strain})` : ''} — {g.accession}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▾</div>
            </div>

            <button
              onClick={handleLoadGenome}
              disabled={!selectedAccession || loadingData}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
            >
              {loadingData ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Loading…</>
              ) : (
                <><Database className="w-4 h-4" />Load Genome</>
              )}
            </button>
          </div>

          {selectedAccession && (
            <div className="flex flex-wrap gap-4 text-xs text-gray-400">
              <span>Accession: <span className="text-emerald-400 font-mono">{selectedAccession}</span></span>
              {isLoaded && (
                <>
                  <span>Total genes in DB: <span className="text-emerald-400 font-semibold">{annotationsData?.totalGenes.toLocaleString()}</span></span>
                  <span>Matching: <span className="text-emerald-400 font-semibold">{annotationsData?.total.toLocaleString()}</span></span>
                </>
              )}
            </div>
          )}
        </section>

        {/* Error banner */}
        {error && (
          <div className="bg-red-950/60 border border-red-700 text-red-300 rounded-xl px-5 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Not loaded hint */}
        {selectedAccession && !isLoaded && !loadingData && !loadingAnnotations && !error && (
          <div className="text-center py-16 text-gray-500">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Genome not yet loaded. Click <strong className="text-gray-300">Load Genome</strong> to fetch annotations from NCBI.</p>
          </div>
        )}

        {/* Annotation table */}
        {isLoaded && (
          <section className="bg-gray-900 rounded-2xl border border-gray-800">
            {/* Filter + Search bar */}
            <div className="px-6 py-4 border-b border-gray-800 space-y-3">
              {/* Molecule type pill filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 mr-1">Show:</span>
                {(['Chromosome', 'Both', 'Plasmid'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setMoleculeFilter(opt); setPage(1) }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${moleculeFilter === opt
                      ? opt === 'Chromosome'
                        ? 'bg-cyan-500/30 text-cyan-300 ring-1 ring-cyan-500/50'
                        : opt === 'Plasmid'
                          ? 'bg-amber-500/30 text-amber-300 ring-1 ring-amber-500/50'
                          : 'bg-gray-600/50 text-gray-200 ring-1 ring-gray-500/50'
                      : 'bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                      }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search by gene name or protein accession…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={fetchAnnotations}
                  disabled={loadingAnnotations}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 transition-colors text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingAnnotations ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Table - no overflow so all columns visible for Cypress; table-fixed keeps it within container */}
            <div>
              <table className="w-full text-sm table-fixed">
                <thead className="bg-gray-800/60 text-gray-400 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left">Organism</th>
                    <th className="px-6 py-3 text-left">Source</th>
                    <th className="px-6 py-3 text-left">Protein Accession</th>
                    <th className="px-6 py-3 text-left">Gene Name</th>
                    <th className="px-6 py-3 text-center">Strand</th>
                    <th className="px-6 py-3 text-center">Directon</th>
                    <th className="px-6 py-3 text-left">COG</th>
                    <th className="px-6 py-3 text-right">Start</th>
                    <th className="px-6 py-3 text-right">Stop</th>
                    <th className="px-6 py-3 text-right">Intergenic Dist.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {loadingAnnotations ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : annotationsData?.annotations.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-gray-500">No results found.</td>
                    </tr>
                  ) : (
                    annotationsData?.annotations.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-3 text-gray-300 text-xs max-w-[180px] truncate" title={annotationsData.organism}>
                          {annotationsData.organism}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.moleculeType === 'Chromosome'
                            ? 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30'
                            : a.moleculeType === 'Plasmid'
                              ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                              : 'bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/30'
                            }`}>
                            {a.moleculeType}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-mono text-emerald-400 text-xs">{a.proteinAccession || '—'}</td>
                        <td className="px-6 py-3 text-gray-200">{a.geneName || '—'}</td>
                        <td className="px-6 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${a.strand === '+' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                            {a.strand}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`text-xs font-mono font-semibold ${a.directonId % 2 === 0 ? 'text-violet-400' : 'text-sky-400'
                              }`}>
                              D{a.directonId}
                            </span>
                            {a.boundaryType && (
                              <span className={`text-[10px] px-1.5 py-px rounded font-medium leading-tight ${a.boundaryType === 'Convergent'
                                ? 'bg-rose-500/15 text-rose-400'
                                : 'bg-teal-500/15 text-teal-400'
                                }`}>
                                {a.boundaryType === 'Convergent' ? '→←' : '←→'} {a.boundaryType}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {a.cogId ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-xs text-gray-200">{a.cogId}</span>
                              {a.cogCategory && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-yellow-400">
                                  <span className="w-4 h-4 rounded bg-yellow-500/20 inline-flex items-center justify-center">{a.cogCategory}</span>
                                  <span className="text-gray-500">{COG_CATEGORIES[a.cogCategory] ?? ''}</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-700 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-gray-300 text-xs">{a.startCoord.toLocaleString()}</td>
                        <td className="px-6 py-3 text-right font-mono text-gray-300 text-xs">{a.stopCoord.toLocaleString()}</td>
                        <td className="px-6 py-3 text-right font-mono text-xs">
                          {a.intergenicDistance === null || a.intergenicDistance === undefined
                            ? <span className="text-gray-600">—</span>
                            : <span className={a.intergenicDistance < 0 ? 'text-red-400' : 'text-violet-400'}>{a.intergenicDistance.toLocaleString()}</span>
                          }
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
                <span>Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
