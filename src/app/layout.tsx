import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Genome Explorer',
  description: 'Prokaryotic genome annotation browser powered by NCBI Datasets API',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
