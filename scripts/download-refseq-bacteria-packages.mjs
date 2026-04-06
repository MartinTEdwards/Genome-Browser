/**
 * Random sample of RefSeq bacterial reference assemblies; download sequence/annotation
 * files until ~10 GB. Each genome: folder named from organism_name + __accession.
 *
 * Usage: node scripts/download-refseq-bacteria-packages.mjs [outputRoot]
 * Default: D:\Genomics\Genomes
 */

import https from 'https'
import fs from 'fs'
import path from 'path'

const ASSEMBLY_SUMMARY =
  'https://ftp.ncbi.nlm.nih.gov/genomes/refseq/bacteria/assembly_summary.txt'
const TARGET_BYTES = 10 * 1024 * 1024 * 1024
const OUT_ROOT = process.argv[2] || 'D:\\Genomics\\Genomes'

const LINK_RE = /<a href="([^"]+)">/g

function httpsGetBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'genome-explorer-download/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location
          if (!loc) return reject(new Error('Redirect without location'))
          return resolve(httpsGetBuffer(new URL(loc, url).href))
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`GET ${url} -> ${res.statusCode}`))
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

function httpsDownloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    const tmp = destPath + '.part'
    const file = fs.createWriteStream(tmp)
    https
      .get(url, { headers: { 'User-Agent': 'genome-explorer-download/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location
          file.close()
          try {
            fs.unlinkSync(tmp)
          } catch { /* empty */ }
          if (!loc) return reject(new Error('Redirect without location'))
          return resolve(httpsDownloadToFile(new URL(loc, url).href, destPath))
        }
        if (res.statusCode !== 200) {
          file.close()
          try {
            fs.unlinkSync(tmp)
          } catch { /* empty */ }
          return reject(new Error(`GET ${url} -> ${res.statusCode}`))
        }
        res.pipe(file)
        file.on('finish', () => {
          file.close(() => {
            fs.rename(tmp, destPath, (err) => (err ? reject(err) : resolve()))
          })
        })
      })
      .on('error', (err) => {
        file.close()
        try {
          fs.unlinkSync(tmp)
        } catch { /* empty */ }
        reject(err)
      })
  })
}

function parseAssemblySummary(tsv) {
  const lines = tsv.toString('utf8').split(/\r?\n/)
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#assembly_accession')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) throw new Error('No header in assembly_summary')
  const headers = lines[headerIdx].replace(/^#/, '').split('\t')
  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    const cols = line.split('\t')
    const row = {}
    headers.forEach((h, j) => {
      row[h] = cols[j] ?? ''
    })
    rows.push(row)
  }
  return rows
}

function filterCandidates(rows) {
  return rows.filter((r) => {
    if (r.refseq_category !== 'reference genome') return false
    const al = r.assembly_level || ''
    if (al !== 'Complete Genome' && al !== 'Chromosome') return false
    const ftp = (r.ftp_path || '').trim()
    if (!ftp || ftp === 'na') return false
    if (!r.assembly_accession || !r.organism_name) return false
    return true
  })
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function safeOrganismDirName(organismName, accession) {
  let s = organismName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim()
  if (s.length > 180) s = s.slice(0, 180)
  if (!s) s = accession
  return `${s}__${accession.replace(/[<>:"/\\|?*]/g, '_')}`
}

function ftpToHttps(ftpPath) {
  return ftpPath
    .replace(/^ftp:\/\/ftp\.ncbi\.nlm\.nih\.gov/i, 'https://ftp.ncbi.nlm.nih.gov')
    .replace(/^ftp:\/\//i, 'https://ftp.ncbi.nlm.nih.gov')
}

function parseIndexFilenames(html) {
  const names = new Set()
  let m
  while ((m = LINK_RE.exec(html)) !== null) {
    const name = m[1]
    if (name === '../' || name.includes('/')) continue
    names.add(name)
  }
  return [...names]
}

function wantedFiles(filenames) {
  const want = []
  for (const f of filenames) {
    if (
      /_genomic\.fna\.gz$/i.test(f) ||
      /_genomic\.gbff\.gz$/i.test(f) ||
      /_genomic\.gff\.gz$/i.test(f) ||
      /_protein\.faa\.gz$/i.test(f) ||
      /_assembly_report\.txt$/i.test(f)
    ) {
      want.push(f)
    }
  }
  return want.sort()
}

async function main() {
  console.log('Fetching', ASSEMBLY_SUMMARY)
  const buf = await httpsGetBuffer(ASSEMBLY_SUMMARY)
  const all = parseAssemblySummary(buf)
  const candidates = filterCandidates(all)
  console.log('Candidate reference assemblies (Complete/Chromosome):', candidates.length)
  shuffle(candidates)

  fs.mkdirSync(OUT_ROOT, { recursive: true })
  let totalBytes = 0
  let nDone = 0
  const usedDirs = new Set()

  for (const row of candidates) {
    if (totalBytes >= TARGET_BYTES * 0.98) break

    const base = ftpToHttps(row.ftp_path).replace(/\/$/, '')
    let html
    try {
      html = (await httpsGetBuffer(base + '/')).toString('utf8')
    } catch (e) {
      console.warn('Skip (index failed)', row.assembly_accession, e.message)
      continue
    }

    const files = wantedFiles(parseIndexFilenames(html))
    if (files.length === 0) {
      console.warn('Skip (no package files)', row.assembly_accession)
      continue
    }

    let dirName = safeOrganismDirName(row.organism_name, row.assembly_accession)
    if (usedDirs.has(dirName)) dirName += `__${nDone}`
    usedDirs.add(dirName)
    const outDir = path.join(OUT_ROOT, dirName)

    let genomeBytes = 0
    for (const f of files) {
      const url = `${base}/${f}`
      const dest = path.join(outDir, f)
      try {
        if (fs.existsSync(dest)) {
          genomeBytes += fs.statSync(dest).size
          continue
        }
        await httpsDownloadToFile(url, dest)
        genomeBytes += fs.statSync(dest).size
      } catch (e) {
        console.warn('  file fail', f, e.message)
      }
    }

    totalBytes += genomeBytes
    nDone++
    console.log(
      `+ ${row.assembly_accession} (${row.organism_name}) ~${(genomeBytes / 1e6).toFixed(1)} MB | total ~${(totalBytes / 1e9).toFixed(2)} GB`
    )
  }

  console.log('Done.', nDone, 'genomes, ~', (totalBytes / 1e9).toFixed(2), 'GB ->', OUT_ROOT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
