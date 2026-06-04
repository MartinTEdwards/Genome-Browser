'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dna } from 'lucide-react'
import { DirectonAnalysisTab } from '@/components/DirectonAnalysisTab'
import { GenomeManagementTab, type LoadedGenome } from '@/components/GenomeManagementTab'
import { GenomeSummaryTab } from '@/components/GenomeSummaryTab'

type ActiveTab = 'genome-management' | 'genome-summary' | 'directon-analysis'

export default function HomePage() {
  const [loadedAccessions, setLoadedAccessions] = useState<Set<string>>(new Set())
  const [loadedGenomes, setLoadedGenomes] = useState<LoadedGenome[]>([])
  const [selectedAccession, setSelectedAccession] = useState('')
  const [activeTab, setActiveTab] = useState<ActiveTab>('genome-management')
  const [metaCycLoaded, setMetaCycLoaded] = useState(false)

  const refreshLoadedGenomes = useCallback(async () => {
    try {
      const res = await fetch('/api/genomes/loaded?all=true')
      const data = await res.json()
      setLoadedGenomes(data.genomes ?? [])
      setLoadedAccessions(new Set(data.loadedAccessions ?? []))
    } catch {
      setLoadedGenomes([])
      setLoadedAccessions(new Set())
    }
  }, [])

  useEffect(() => {
    refreshLoadedGenomes()
  }, [refreshLoadedGenomes])

  useEffect(() => {
    fetch('/api/metacyc/ingest')
      .then((r) => r.json())
      .then((d) => {
        if (d.loaded) {
          setMetaCycLoaded(true)
        } else {
          fetch('/api/metacyc/ingest', { method: 'POST' })
            .then((r) => r.json())
            .then((d) => {
              if (d.success) setMetaCycLoaded(true)
            })
            .catch(() => console.warn('MetaCyc auto-ingest failed'))
        }
      })
      .catch(() => console.warn('MetaCyc status check failed'))
  }, [])

  const handleLoadedChange = (accessions: Set<string>) => {
    setLoadedAccessions(accessions)
    refreshLoadedGenomes()
    if (selectedAccession && !accessions.has(selectedAccession)) {
      setSelectedAccession('')
    }
  }

  const tabClass = (tab: ActiveTab) =>
    `px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
      activeTab === tab
        ? 'border-emerald-500 text-emerald-400'
        : 'border-transparent text-gray-500 hover:text-gray-300'
    }`

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Dna className="w-6 h-6" data-cy="genome-explorer-dna-icon" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-cy="genome-explorer-title">
              Genome Explorer
            </h1>
            <p className="text-xs text-gray-400" data-cy="genome-explorer-subtitle">
              Prokaryotic genome annotation browser — Phase 2 (EC-centric)
            </p>
          </div>
          {metaCycLoaded && (
            <span
              className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 font-semibold"
              data-cy="metacyc-status"
            >
              MetaCyc2GO loaded
            </span>
          )}
        </div>
      </header>

      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('genome-management')}
              className={tabClass('genome-management')}
            >
              Genome Management
            </button>
            <button
              onClick={() => setActiveTab('genome-summary')}
              className={tabClass('genome-summary')}
              data-cy="genome-summary-tab-label"
            >
              Genome Summary
            </button>
            <button
              onClick={() => setActiveTab('directon-analysis')}
              className={tabClass('directon-analysis')}
              data-cy="directon-analysis-tab-label"
            >
              Directon Analysis
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {activeTab === 'genome-management' && (
          <GenomeManagementTab
            loadedAccessions={loadedAccessions}
            onLoadedChange={handleLoadedChange}
          />
        )}
        {activeTab === 'genome-summary' && (
          <GenomeSummaryTab
            loadedGenomes={loadedGenomes}
            loadedAccessions={loadedAccessions}
            selectedAccession={selectedAccession}
            onSelectAccession={setSelectedAccession}
          />
        )}
        {activeTab === 'directon-analysis' && (
          <DirectonAnalysisTab
            loadedGenomes={loadedGenomes.map((g) => ({
              accession: g.accession,
              organismName: g.organism,
            }))}
            loadedAccessions={loadedAccessions}
            onCorpusLoaded={() => refreshLoadedGenomes()}
          />
        )}
      </main>
    </div>
  )
}
