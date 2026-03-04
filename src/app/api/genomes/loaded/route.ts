import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const genomes = await prisma.genome.findMany({
      select: { accession: true },
    })
    return NextResponse.json({
      loadedAccessions: genomes.map((g) => g.accession),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ loadedAccessions: [] }, { status: 500 })
  }
}
