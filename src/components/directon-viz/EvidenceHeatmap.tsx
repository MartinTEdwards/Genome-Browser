'use client'

interface EvidenceHeatmapProps {
  selectedCogs: string[]
  genomeDirectons: Array<{
    genomeAccession: string
    organism: string
    genes: Set<string>
    directonLabel: string
  }>
  freqMap: Map<string, number>
}

export function EvidenceHeatmap({
  selectedCogs,
  genomeDirectons,
  freqMap,
}: EvidenceHeatmapProps) {
  if (selectedCogs.length === 0) return null

  const cogSet = new Set(selectedCogs)

  const rows = genomeDirectons.filter((gd) => {
    const matchCount = selectedCogs.filter((c) => gd.genes.has(c)).length
    return matchCount >= 2
  })

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">
        Evidence — directons sharing this sentence
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-gray-500 font-medium sticky left-0 bg-gray-800/90">
                Assembly / directon
              </th>
              {selectedCogs.map((cog) => {
                const freq = freqMap.get(cog) ?? 0.0001
                const ic = -Math.log2(freq)
                const opacity = Math.min(1, ic / 10)
                return (
                  <th
                    key={cog}
                    className="px-2 py-2 text-center text-gray-400 font-mono"
                    title={`IC: ${ic.toFixed(2)}`}
                  >
                    {cog}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 30).map((row, ri) => (
              <tr key={`${row.directonLabel}-${ri}`} className="border-t border-gray-700/50">
                <td
                  className="py-1.5 pr-4 text-gray-400 truncate max-w-[240px] sticky left-0 bg-gray-800/90"
                  title={`${row.genomeAccession} — ${row.directonLabel}`}
                >
                  <span className="text-gray-300">{row.genomeAccession}</span>
                  <span className="text-gray-600"> · </span>
                  <span className="text-gray-500">{row.directonLabel}</span>
                </td>
                {selectedCogs.map((cog) => {
                  const has = row.genes.has(cog)
                  const freq = freqMap.get(cog) ?? 0.0001
                  const ic = -Math.log2(freq)
                  const opacity = Math.min(1, 0.3 + (ic / 12) * 0.7)

                  return (
                    <td key={cog} className="px-2 py-1.5 text-center">
                      {has ? (
                        <span
                          className="inline-block w-4 h-4 rounded-sm bg-emerald-500"
                          style={{ opacity: Math.max(0.5, opacity) }}
                          title={`${cog} (IC ${ic.toFixed(2)})`}
                        />
                      ) : (
                        <span className="inline-block w-4 h-4 rounded-sm bg-gray-700/50" />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 30 && (
          <div className="text-xs text-gray-500 mt-2">
            … and {rows.length - 30} more directons
          </div>
        )}
      </div>
    </div>
  )
}
