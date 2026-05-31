// ⚠️  RIMUOVERE PRIMA DI ANDARE IN PROD REALE
import { neon } from '@neondatabase/serverless'

export async function GET() {
  const results: Record<string, unknown> = {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.slice(0, 30) + '...)' : 'MISSING',
    SESSION_SECRET: process.env.SESSION_SECRET ? `SET (${process.env.SESSION_SECRET.length} chars)` : 'MISSING',
    NODE_ENV: process.env.NODE_ENV,
  }

  if (process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL)
      const rows = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
      results.db_tables = rows.map(r => r.table_name)
      results.db_status = 'OK'
    } catch (e) {
      results.db_status = 'ERROR'
      results.db_error = String(e)
    }
  }

  return Response.json(results)
}
