'use client'

import { useState, useMemo, useRef } from 'react'
import { DirectonTrack } from './DirectonTrack'
import { EvidenceHeatmap } from './EvidenceHeatmap'
import { ChevronDown } from 'lucide-react'

export interface ComparisonMatch {
  sourceId: string
  targetId: string
  overlapCount: number
  sharedECs: string[]
  pValue: number
}

export interface DirectonWithPartitions {
  id: string
  genomeId: string
  genomeAccession: string
  organism: string
  moleculeType: string
  strand: string
  genes: string[]
  partitions: Set<string>[]
  matches?: ComparisonMatch[]
}

export interface GenomeDirecton {
  genomeAccession: string
  organism: string
  genes: Set<string>
  /** One row per directon; disambiguates same assembly on multiple replicons / regions */
  directonLabel: string
}

interface DirectonVisualizerProps {
  directons: DirectonWithPartitions[]
  allGenomeDirectons: GenomeDirecton[]
  directonIdToTarget?: Map<string, { genomeAccession: string; organism: string }>
  width?: number
}

export function DirectonVisualizer({
  directons,
  allGenomeDirectons,
  directonIdToTarget = new Map(),
  width = 800,
}: DirectonVisualizerProps) {
  const [selectedSentence, setSelectedSentence] = useState<{
    ecs: string[]
    sourceDirectonId: string
  } | null>(null)
  const evidencePanelRef = useRef<HTMLDivElement>(null)

  const freqMap = useMemo(() => {
    const map = new Map<string, number>()
    let totalDirectons = 0
    for (const gd of allGenomeDirectons) {
      totalDirectons++
      for (const ec of gd.genes) {
        map.set(ec, (map.get(ec) ?? 0) + 1)
      }
    }
    const freqMapOut = new Map<string, number>()
    for (const [ec, count] of map) {
      freqMapOut.set(ec, count / totalDirectons)
    }
    return freqMapOut
  }, [allGenomeDirectons])

  const handleSentenceClick = (ecs: string[], sourceDirectonId: string) => {
    setSelectedSentence({ ecs, sourceDirectonId })
    evidencePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const supportingMatches = useMemo(() => {
    if (!selectedSentence) return []
    const directon = directons.find((d) => d.id === selectedSentence.sourceDirectonId)
    const matches = directon?.matches ?? []
    return matches.filter((m) => selectedSentence.ecs.every((c) => m.sharedECs.includes(c)))
  }, [selectedSentence, directons])

  return (
    <div className="space-y-4">
      <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
        {directons.map((d) => (
          <DirectonTrack
            key={d.id}
            directonId={d.id}
            genomeAccession={d.genomeAccession}
            moleculeType={d.moleculeType}
            genes={d.genes}
            partitions={d.partitions.map((p) => ({ genes: p }))}
            selectedECs={selectedSentence ? new Set(selectedSentence.ecs) : null}
            onSentenceClick={(ecs) => handleSentenceClick(ecs, d.id)}
            width={width}
          />
        ))}
      </div>

      {selectedSentence && selectedSentence.ecs.length > 0 && (
        <div ref={evidencePanelRef} className="space-y-4 rounded-xl border-2 border-emerald-500/30 bg-gray-800/80 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
            Supporting evidence for sentence: {selectedSentence.ecs.map((ec) => `EC ${ec}`).join(', ')}
          </div>

          {supportingMatches.length > 0 && (
            <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
              <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                Directon matches (p &lt; 0.001)
              </h5>
              <div className="max-h-32 overflow-y-auto space-y-1.5 text-xs">
                {supportingMatches.map((m, i) => {
                  const target = directonIdToTarget.get(m.targetId)
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-4 py-1.5 px-2 rounded bg-gray-800/50 font-mono"
                    >
                      <span className="text-cyan-400 truncate">{m.targetId}</span>
                      {target && (
                        <span className="text-gray-500 truncate max-w-[140px]" title={target.organism}>
                          {target.genomeAccession}
                        </span>
                      )}
                      <span className="text-emerald-400">overlap: {m.overlapCount}</span>
                      <span className="text-gray-500">p={m.pValue.toExponential(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <EvidenceHeatmap
            selectedECs={selectedSentence.ecs}
            genomeDirectons={allGenomeDirectons}
            freqMap={freqMap}
          />
        </div>
      )}
    </div>
  )
}
