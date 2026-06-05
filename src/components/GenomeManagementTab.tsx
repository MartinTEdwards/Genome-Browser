'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, ChevronLeft, ChevronRight, Download, Trash2 } from 'lucide-react'

export interface CatalogGenome {
  accession: string
  organismName: string
  strain: string
  assemblyName: string
  totalGenes: number | string
}

export interface LoadedGenome {
  accession: string
  organism: string
  totalGenes: number
}

interface GenomeManagementTabProps {
  loadedAccessions: Set<string>
  onLoadedChange: (accessions: Set<string>) => void
}

export function GenomeManagementTab({
  loadedAccessions,
  onLoadedChange,
}: GenomeManagementTabProps) {
  const [catalogPage, setCatalogPage] = useState(0)
  const [pageTokens, setPageTokens] = useState<string[]>([''])
  const [catalogGenomes, setCatalogGenomes] = useState<CatalogGenome[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [hasNextCatalog, setHasNextCatalog] = useState(false)

  const [selectedDownload, setSelectedDownload] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 })
  const [downloadErrors, setDownloadErrors] = useState<string[]>([])

  const [downloadedPage, setDownloadedPage] = useState(1)
  const [downloadedGenomes, setDownloadedGenomes] = useState<LoadedGenome[]>([])
  const [downloadedTotal, setDownloadedTotal] = useState(0)
  const [downloadedLoading, setDownloadedLoading] = useState(false)
  const [selectedDelete, setSelectedDelete] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const pageSize = 25
  const downloadedTotalPages = Math.max(1, Math.ceil(downloadedTotal / pageSize))

  const fetchDownloaded = useCallback(async (page: number) => {
    setDownloadedLoading(true)
    try {
      const res = await fetch(`/api/genomes/loaded?page=${page}&pageSize=${pageSize}`)
      const data = await res.json()
      setDownloadedGenomes(data.genomes ?? [])
      setDownloadedTotal(data.total ?? 0)
    } catch {
      setDownloadedGenomes([])
      setDownloadedTotal(0)
    } finally {
      setDownloadedLoading(false)
    }
  }, [])

  const refreshLoadedAccessions = useCallback(async () => {
    const res = await fetch('/api/genomes/loaded?all=true')
    const data = await res.json()
    onLoadedChange(new Set(data.loadedAccessions ?? []))
  }, [onLoadedChange])

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      setCatalogLoading(true)
      setCatalogError('')
      try {
        const token = pageTokens[catalogPage] ?? ''
        const params = new URLSearchParams({ pageSize: String(pageSize) })
        if (token) params.set('pageToken', token)
        const res = await fetch(`/api/genomes?${params}`)
        if (!res.ok) throw new Error('Failed to fetch catalog')
        const data = await res.json()
        if (cancelled) return
        setCatalogGenomes(data.genomes ?? [])
        setHasNextCatalog(!!data.nextPageToken)
        if (data.nextPageToken) {
          setPageTokens((prev) => {
            const next = [...prev]
            next[catalogPage + 1] = data.nextPageToken
            return next
          })
        }
      } catch {
        if (!cancelled) setCatalogError('Failed to load genome catalog from NCBI.')
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }
    loadCatalog()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when catalog page index changes
  }, [catalogPage])

  useEffect(() => {
    fetchDownloaded(downloadedPage)
  }, [downloadedPage, fetchDownloaded])

  const toggleDownload = (accession: string) => {
    setSelectedDownload((prev) => {
      const next = new Set(prev)
      if (next.has(accession)) next.delete(accession)
      else next.add(accession)
      return next
    })
  }

  const toggleDelete = (accession: string) => {
    setSelectedDelete((prev) => {
      const next = new Set(prev)
      if (next.has(accession)) next.delete(accession)
      else next.add(accession)
      return next
    })
  }

  const handleSelectAllDelete = () => {
    setSelectedDelete(new Set(downloadedGenomes.map((g) => g.accession)))
  }

  const handleDownload = async () => {
    const ordered = catalogGenomes
      .map((g) => g.accession)
      .filter((a) => selectedDownload.has(a) && !loadedAccessions.has(a))
      .slice(0, 25)

    if (ordered.length === 0) return

    setDownloading(true)
    setDownloadErrors([])
    setDownloadProgress({ current: 0, total: ordered.length })

    const errors: string[] = []
    const newLoaded = new Set(loadedAccessions)

    for (let i = 0; i < ordered.length; i++) {
      const accession = ordered[i]
      const g = catalogGenomes.find((x) => x.accession === accession)
      const organismName = g
        ? g.organismName + (g.strain ? ` (${g.strain})` : '')
        : accession
      try {
        const res = await fetch('/api/genomes/load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accession, organismName }),
        })
        if (!res.ok) {
          const err = await res.json()
          errors.push(`${accession}: ${err.error ?? 'Load failed'}`)
        } else {
          newLoaded.add(accession)
        }
      } catch {
        errors.push(`${accession}: Network error`)
      }
      setDownloadProgress({ current: i + 1, total: ordered.length })
    }

    onLoadedChange(newLoaded)
    setDownloadErrors(errors)
    setDownloading(false)
    setSelectedDownload(new Set())
    setDownloadedPage(1)
    await refreshLoadedAccessions()
    fetchDownloaded(1)
  }

  const handleDelete = async () => {
    if (selectedDelete.size === 0) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/genomes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessions: Array.from(selectedDelete) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      if (data.failed?.length) {
        setDeleteError(
          data.failed.map((f: { accession: string; error: string }) => `${f.accession}: ${f.error}`).join('; ')
        )
      }
      setSelectedDelete(new Set())
      await refreshLoadedAccessions()
      const newPage = downloadedPage > 1 && downloadedGenomes.length <= selectedDelete.size
        ? Math.max(1, downloadedPage - 1)
        : downloadedPage
      setDownloadedPage(newPage)
      fetchDownloaded(newPage)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const catalogHasPrev = catalogPage > 0
  const downloadSelectionCount = Array.from(selectedDownload).filter(
    (a) => !loadedAccessions.has(a)
  ).length

  return (
    <section className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
        Genome Management
      </h2>

      {(catalogError || deleteError || downloadErrors.length > 0) && (
        <div className="space-y-2">
          {catalogError && (
            <div className="bg-red-950/60 border border-red-700 text-red-300 rounded-xl px-5 py-3 text-sm">
              {catalogError}
            </div>
          )}
          {deleteError && (
            <div className="bg-red-950/60 border border-red-700 text-red-300 rounded-xl px-5 py-3 text-sm">
              {deleteError}
            </div>
          )}
          {downloadErrors.length > 0 && (
            <div className="bg-amber-950/60 border border-amber-700 text-amber-300 rounded-xl px-5 py-3 text-sm">
              {downloadErrors.join('; ')}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available genomes (left) */}
        <div className="space-y-3 border border-gray-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Available prokaryotic genomes
          </h3>
          {catalogLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : (
            <ul className="space-y-1 max-h-[420px] overflow-y-auto">
              {catalogGenomes.map((g) => {
                const isLoaded = loadedAccessions.has(g.accession)
                return (
                  <li
                    key={g.accession}
                    className={`flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-gray-800/50 ${isLoaded ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDownload.has(g.accession)}
                      onChange={() => toggleDownload(g.accession)}
                      disabled={downloading}
                      className="mt-1 rounded border-gray-600"
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="text-gray-200 truncate">
                        {g.organismName}
                        {g.strain ? ` (${g.strain})` : ''}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{g.accession}</div>
                      {isLoaded && (
                        <span className="text-[10px] text-emerald-500">Downloaded</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-800">
            <div className="flex gap-2">
              <button
                onClick={() => setCatalogPage((p) => Math.max(0, p - 1))}
                disabled={!catalogHasPrev || catalogLoading}
                className="p-2 rounded-lg border border-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCatalogPage((p) => p + 1)}
                disabled={!hasNextCatalog || catalogLoading}
                className="p-2 rounded-lg border border-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloadSelectionCount === 0 || downloading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-sm font-semibold"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {downloadProgress.current}/{downloadProgress.total}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download
                </>
              )}
            </button>
          </div>
        </div>

        {/* Downloaded genomes (right) */}
        <div className="space-y-3 border border-gray-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Downloaded genomes
          </h3>
          {downloadedLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : downloadedGenomes.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No genomes downloaded yet.</p>
          ) : (
            <ul className="space-y-1 max-h-[420px] overflow-y-auto">
              {downloadedGenomes.map((g) => (
                <li
                  key={g.accession}
                  className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-gray-800/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedDelete.has(g.accession)}
                    onChange={() => toggleDelete(g.accession)}
                    disabled={deleting}
                    className="mt-1 rounded border-gray-600"
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="text-gray-200 truncate">{g.organism}</div>
                    <div className="text-xs text-gray-500 font-mono">{g.accession}</div>
                    <div className="text-[10px] text-gray-600">
                      {g.totalGenes.toLocaleString()} genes
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-800">
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setDownloadedPage((p) => Math.max(1, p - 1))}
                disabled={downloadedPage <= 1 || downloadedLoading}
                className="p-2 rounded-lg border border-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500">
                Page {downloadedPage} of {downloadedTotalPages}
              </span>
              <button
                onClick={() => setDownloadedPage((p) => Math.min(downloadedTotalPages, p + 1))}
                disabled={downloadedPage >= downloadedTotalPages || downloadedLoading}
                className="p-2 rounded-lg border border-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAllDelete}
                data-cy="select-all-delete-button"
                disabled={downloadedGenomes.length === 0 || deleting}
                className="px-3 py-2 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-100 text-xs font-medium disabled:opacity-50"
              >
                Select All
              </button>
              <button
                onClick={handleDelete}
                data-cy="delete-genomes-button"
                disabled={selectedDelete.size === 0 || deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-900/80 hover:bg-red-800 disabled:bg-gray-700 disabled:cursor-not-allowed text-sm font-semibold"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
