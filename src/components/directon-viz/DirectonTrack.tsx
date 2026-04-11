'use client'

const ARC_COLORS = ['rgb(59 130 246)', 'rgb(16 185 129)', 'rgb(168 85 247)', 'rgb(245 158 11)']

interface SentencePartition {
  genes: Set<string>
}

interface DirectonTrackProps {
  directonId: string
  genomeAccession: string
  moleculeType: string
  genes: string[]
  partitions: SentencePartition[]
  selectedECs: Set<string> | null
  onSentenceClick: (ecs: string[]) => void
  width?: number
  blockHeight?: number
}

export function DirectonTrack({
  directonId,
  genomeAccession,
  moleculeType,
  genes,
  partitions,
  selectedECs,
  onSentenceClick,
  width = 800,
  blockHeight = 28,
}: DirectonTrackProps) {
  const geneCount = genes.length
  if (geneCount === 0) return null

  const blockWidth = Math.max(40, (width - 40) / geneCount - 4)
  const backboneY = blockHeight + 20
  const arcBaseY = 8

  const geneToIndex = new Map<string, number>()
  genes.forEach((g, i) => geneToIndex.set(g, i))

  const isGeneInSelected = (ec: string) => selectedECs?.has(ec) ?? false

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <div className="mb-1 text-xs text-gray-500 font-mono">
        {genomeAccession} • {moleculeType} • {directonId}
      </div>
      <svg
        width={width}
        height={backboneY + 30}
        className="overflow-visible"
        style={{ shapeRendering: 'crispEdges' }}
      >
        {/* Functional layer - sentence arcs on top */}
        <g>
          {partitions.map((partition, pi) => {
            const indices = Array.from(partition.genes)
              .map((c) => geneToIndex.get(c))
              .filter((i): i is number => i !== undefined)
            if (indices.length === 0) return null
            const x1 = 20 + Math.min(...indices) * (blockWidth + 4) + blockWidth / 2
            const x2 = 20 + Math.max(...indices) * (blockWidth + 4) + blockWidth / 2
            const arcHeight = 12 + pi * 10
            const midX = (x1 + x2) / 2

            return (
              <path
                key={pi}
                d={`M ${x1} ${arcBaseY} Q ${midX} ${arcBaseY - arcHeight} ${x2} ${arcBaseY}`}
                fill="none"
                stroke={ARC_COLORS[pi % ARC_COLORS.length]}
                strokeWidth={2}
                strokeOpacity={0.8}
                style={{ vectorEffect: 'non-scaling-stroke' }}
                className="cursor-pointer hover:stroke-opacity-100 transition-opacity"
                onClick={() => onSentenceClick(Array.from(partition.genes))}
              />
            )
          })}
        </g>

        {/* Physical layer - backbone */}
        <line
          x1={20}
          y1={backboneY}
          x2={width - 20}
          y2={backboneY}
          stroke="rgb(75 85 99)"
          strokeWidth={1}
          opacity={0.6}
        />

        {/* Gene blocks (EC tokens) */}
        {genes.map((ec, i) => {
          const x = 20 + i * (blockWidth + 4)
          const inPartition = partitions.some((p) => p.genes.has(ec))
          const selected = isGeneInSelected(ec)

          return (
            <g key={`${ec}-${i}`}>
              <rect
                x={x}
                y={backboneY - blockHeight - 4}
                width={blockWidth}
                height={blockHeight}
                fill={inPartition ? 'rgb(30 64 175)' : 'rgb(55 65 81)'}
                fillOpacity={inPartition ? 0.5 : 0.3}
                stroke={selected ? 'rgb(16 185 129)' : 'rgb(75 85 99)'}
                strokeWidth={selected ? 2 : 1}
                rx={2}
                style={{ shapeRendering: 'crispEdges' }}
              />
              <text
                x={x + blockWidth / 2}
                y={backboneY - blockHeight / 2 - 4}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-gray-300 text-[10px] font-mono"
              >
                {ec.length > 8 ? ec.slice(0, 6) + '..' : ec}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
