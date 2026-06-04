#!/usr/bin/env node
/**
 * CLI: npm run fixture:genome
 * Options: --accession, --organism, --sample-size, --out-dir, --base-url
 */

import { downloadGenomeFixture } from './lib/downloadGenomeFixture.mjs'

function parseArgs(argv) {
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--accession' && argv[i + 1]) opts.accession = argv[++i]
    else if (a === '--organism' && argv[i + 1]) opts.organismName = argv[++i]
    else if (a === '--sample-size' && argv[i + 1])
      opts.sampleSize = parseInt(argv[++i], 10)
    else if (a === '--out-dir' && argv[i + 1]) opts.outDir = argv[++i]
    else if (a === '--base-url' && argv[i + 1]) opts.baseUrl = argv[++i]
    else if (a === '--help' || a === '-h') opts.help = true
  }
  return opts
}

const opts = parseArgs(process.argv.slice(2))
if (opts.help) {
  console.log(`Usage: npm run fixture:genome [-- options]

Options:
  --accession <id>     Default: GCF_000195955.2
  --organism <name>    Organism label for load API
  --sample-size <n>    Genes to export (default: 100)
  --out-dir <path>     Default: cypress/fixtures
  --base-url <url>     Default: http://localhost:3000

Requires: npm run dev and MetaCyc ingested.`)
  process.exit(0)
}

try {
  const result = await downloadGenomeFixture(opts)
  console.log(
    `Wrote ${result.sampleSize} genes (of ${result.totalGenes} total) to:\n  ${result.outPath}`
  )
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}
