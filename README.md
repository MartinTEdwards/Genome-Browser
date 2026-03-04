# Genome Explorer

A prokaryotic genome annotation browser powered by the NCBI Datasets API. Browse reference genomes, load annotations (genes, COG categories, directons), and filter by molecule type or search terms.

## Features

- **Genome selection** — Pick from reference prokaryotic genomes (NCBI taxon 2)
- **Load annotations** — Fetch gene annotations, COG categories, molecule types, directons, and intergenic distances from NCBI
- **Filter & search** — Filter by Chromosome/Plasmid, search by gene name or protein accession, paginated results

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure database**

   Copy the example env file and set `DATABASE_URL`:

   ```bash
   cp .env.example .env
   ```

   Default SQLite path is `file:./dev.db`. Adjust in `.env` if needed.

3. **Run migrations**

   ```bash
   npx prisma migrate dev
   ```

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command       | Description                |
|---------------|----------------------------|
| `npm run dev` | Start development server   |
| `npm run build` | Build for production    |
| `npm run start` | Start production server  |
| `npm run lint` | Run ESLint                |

## Tech Stack

- [Next.js](https://nextjs.org) 16 (App Router)
- [React](https://react.dev) 19
- [Prisma](https://www.prisma.io) + SQLite
- [Tailwind CSS](https://tailwindcss.com) 4
- [NCBI Datasets API](https://www.ncbi.nlm.nih.gov/datasets/), [COG API](https://www.ncbi.nlm.nih.gov/research/cog/)
# Genome-Browser
A simple prokaryotic genome browser focusing on Inter Genic Distance and strand transition
