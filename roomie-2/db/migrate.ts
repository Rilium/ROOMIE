#!/usr/bin/env tsx
// Run: DATABASE_URL=... npx tsx db/migrate.ts
// Applies all numbered SQL migrations in order to the Neon database.

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { neon } from '@neondatabase/serverless'

const __dirname = dirname(fileURLToPath(import.meta.url))

function splitSql(sqlText: string): string[] {
  const statements: string[] = []
  let current = ''
  let inDollarBlock = false

  for (const rawLine of sqlText.split('\n')) {
    const codeLine = rawLine.replace(/--.*$/, '')
    const line = codeLine.trim()
    if (!line || line.startsWith('--')) continue

    const dollarMatches = codeLine.match(/\$\$/g)
    if (dollarMatches && dollarMatches.length % 2 === 1) {
      inDollarBlock = !inDollarBlock
    }

    current += codeLine + '\n'
    if (!inDollarBlock && line.endsWith(';')) {
      const statement = current.trim().replace(/;$/, '').trim()
      if (statement) statements.push(statement)
      current = ''
    }
  }

  const tail = current.trim()
  if (tail) statements.push(tail.replace(/;$/, '').trim())
  return statements
}

async function main() {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL
  if (!url) {
    console.error('ERROR: DATABASE_URL not set')
    process.exit(1)
  }

  const sql = neon(url)
  const files = readdirSync(__dirname)
    .filter(file => /^\d+_.+\.sql$/.test(file))
    .sort()

  console.log(`Applying migrations (${files.length} files)...`)
  for (const file of files) {
    const schemaPath = join(__dirname, file)
    const schema = readFileSync(schemaPath, 'utf8')
    const statements = splitSql(schema)
    console.log(`- ${file} (${statements.length} statements)`)
    for (const statement of statements) {
      await sql.query(statement)
    }
  }
  console.log('Migrations applied OK.')
}

main().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
