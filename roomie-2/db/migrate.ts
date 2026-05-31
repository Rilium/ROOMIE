#!/usr/bin/env tsx
// Run: DATABASE_URL=... npx tsx db/migrate.ts
// Applies 001_initial_schema.sql to the Neon database.

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { neon } from '@neondatabase/serverless'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('ERROR: DATABASE_URL not set')
    process.exit(1)
  }

  const sql = neon(url)
  const schemaPath = join(__dirname, '001_initial_schema.sql')
  const schema = readFileSync(schemaPath, 'utf8')

  console.log('Applying schema...')
  // Split on semicolons — crude but works for DDL without pl/pgsql bodies
  // For the DO $$ blocks, we need to send them whole
  // Simple approach: send entire file as one transaction
  // Use unsafe to run raw DDL (no parameterization needed for schema files)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sql as any).unsafe(schema)
  console.log('Schema applied OK.')
}

main().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
