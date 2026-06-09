'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import type { LoadedGenome } from '@/components/GenomeManagementTab'

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
  goTerms: string
  ecNumber: string | null
}

function formatGoCell(goTermsJson: string): { label: string; title: string } {
  if (!goTermsJson || goTermsJson === '[]') return { label: '—', title: '' }
  try {
    const arr = JSON.parse(goTermsJson) as unknown
    if (!Array.isArray(arr) || arr.length === 0) return { label: '—', title: '' }
    const ids = arr.filter((x): x is string => typeof x === 'string')
    const full = ids.join(', ')
    if (ids.length <= 2) return { label: full, title: full }
    return { label: `${ids.slice(0, 2).join(', ')} +${ids.length - 2}`, title: full }
  } catch {
    return { label: '—', title: '' }
  }
}

interface AnnotationsResponse {
  organism: string
  totalGenes: number
  total: number
  page: number
  pageSize: number
  annotations: Annotation[]
}

interface GenomeSummaryTabProps {
  loadedGenomes: LoadedGenome[]
  loadedAccessions: Set<string>
  selectedAccession: string
  onSelectAccession: (accession: string) => void
}

export function GenomeSummaryTab({
  loadedGenomes,
  loadedAccessions,
  selectedAccession,
  onSelectAccession,
}: GenomeSummaryTabProps) {
  const [loadingAnnotations, setLoadingAnnotations] = useState(false)
  const [annotationsData, setAnnotationsData] = useState<AnnotationsResponse | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const fetchAnnotations = useCallback(async () => {
    if (!selectedAccession) return
    setLoadingAnnotations(true)
    setError('')
    try {
      const params = new URLSearchParams({
        accession: selectedAccession,
        search: debouncedSearch,
        page: String(page),
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
  }, [selectedAccession, debouncedSearch, page])

  useEffect(() => {
    fetchAnnotations()
  }, [fetchAnnotations])

  useEffect(() => {
    if (selectedAccession && !loadedAccessions.has(selectedAccession)) {
      onSelectAccession('')
      setAnnotationsData(null)
    }
  }, [loadedAccessions, selectedAccession, onSelectAccession])

  const handleSelectGenome = (accession: string) => {
    onSelectAccession(accession)
    setAnnotationsData(null)
    setPage(1)
    setSearch('')
  }

  const isLoaded = !!annotationsData
  const totalPages = annotationsData ? Math.ceil(annotationsData.total / annotationsData.pageSize) : 1

  return (
    <>
      <section className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-4" data-cy="genome-selector-pane">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest" data-cy="genome-selector-pane-title">
          Select Genome
        </h2>

        <div className="relative flex-1 max-w-xl">
          <select
            value={selectedAccession}
            onChange={(e) => handleSelectGenome(e.target.value)}
            disabled={loadedGenomes.length === 0}
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 pr-10 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="" data-cy="select-organism-text">
              {loadedGenomes.length === 0 ? '— No downloaded genomes —' : '— Select an organism —'}
            </option>
            {loadedGenomes.map((g) => (
              <option key={g.accession} value={g.accession}>
                {g.organism} — {g.accession}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▾</div>
        </div>

        {selectedAccession && (
          <div className="flex flex-wrap gap-4 text-xs text-gray-400">
            <span>
              Accession: <span className="text-emerald-400 font-mono">{selectedAccession}</span>
            </span>
            {isLoaded && (
              <>
                <span>
                  Total genes in DB:{' '}
                  <span className="text-emerald-400 font-semibold">
                    {annotationsData?.totalGenes.toLocaleString()}
                  </span>
                </span>
                <span>
                  Matching:{' '}
                  <span className="text-emerald-400 font-semibold">
                    {annotationsData?.total.toLocaleString()}
                  </span>
                </span>
              </>
            )}
          </div>
        )}
      </section>

      {error && (
        <div className="bg-red-950/60 border border-red-700 text-red-300 rounded-xl px-5 py-3 text-sm">
          {error}
        </div>
      )}

      {selectedAccession && !isLoaded && !loadingAnnotations && !error && (
        <div className="text-center py-16 text-gray-500">
          <p>Loading annotations…</p>
        </div>
      )}

      {isLoaded && (
        <section className="bg-gray-900 rounded-2xl border border-gray-800">
          <div className="px-6 py-4 border-b border-gray-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by gene name, protein accession, GO term, or EC number…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
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

          <div>
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-800/60 text-gray-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left" data-cy="organism-column">Organism</th>
                  <th className="px-6 py-3 text-left" data-cy ="source-column">Source</th>
                  <th className="px-6 py-3 text-left" data-cy="protein-accession-column">Protein Accession</th>
                  <th className="px-6 py-3 text-left" data-cy="gene-name-column">Gene Name</th>
                  <th className="px-6 py-3 text-center" data-cy="strand-column">Strand</th>
                  <th className="px-6 py-3 text-center" data-cy="directon-column">Directon</th>
                  <th className="px-6 py-3 text-left" data-cy="ec-number-column">EC Number</th>
                  <th className="px-6 py-3 text-left" data-cy="go-column">GO</th>
                  <th className="px-6 py-3 text-right" data-cy="start-column">Start</th>
                  <th className="px-6 py-3 text-right" data-cy="stop-column">Stop</th>
                  <th className="px-6 py-3 text-right" data-cy="intergenic-dist-column">Intergenic Dist.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loadingAnnotations ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : annotationsData?.annotations.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                      No results found.
                    </td>
                  </tr>
                ) : (
                  annotationsData?.annotations.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-800/40 transition-colors">
                      <td
                        className="px-6 py-3 text-gray-300 text-xs max-w-[180px] truncate"
                        title={annotationsData.organism}
                      >
                        {annotationsData.organism}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30">
                          {a.moleculeType === 'Chromosome' ? 'Chromosome' : a.moleculeType}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-emerald-400 text-xs">
                        {a.proteinAccession || '—'}
                      </td>
                      <td className="px-6 py-3 text-gray-200">{a.geneName || '—'}</td>
                      <td className="px-6 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${a.strand === '+' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}
                        >
                          {a.strand}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`text-xs font-mono font-semibold ${a.directonId % 2 === 0 ? 'text-violet-400' : 'text-sky-400'}`}
                          >
                            D{a.directonId}
                          </span>
                          {a.boundaryType && (
                            <span
                              className={`text-[10px] px-1.5 py-px rounded font-medium leading-tight ${a.boundaryType === 'Convergent' ? 'bg-rose-500/15 text-rose-400' : 'bg-teal-500/15 text-teal-400'}`}
                            >
                              {a.boundaryType === 'Convergent' ? '→←' : '←→'} {a.boundaryType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {a.ecNumber ? (
                          <span className="font-mono text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            EC {a.ecNumber}
                          </span>
                        ) : (
                          <span className="text-gray-700 text-xs">—</span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-mono text-gray-300 max-w-[140px] truncate"
                        title={formatGoCell(a.goTerms ?? '[]').title}
                      >
                        {formatGoCell(a.goTerms ?? '[]').label}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-gray-300 text-xs">
                        {a.startCoord.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-gray-300 text-xs">
                        {a.stopCoord.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs">
                        {a.intergenicDistance === null || a.intergenicDistance === undefined ? (
                          <span className="text-gray-600">—</span>
                        ) : (
                          <span
                            className={a.intergenicDistance < 0 ? 'text-red-400' : 'text-violet-400'}
                          >
                            {a.intergenicDistance.toLocaleString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
              <span>
                Page {page} of {totalPages}
              </span>
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
    </>
  )
}
