const fs = require('fs');
const path = require('path');

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
  if (!databaseUrl) {
    throw new Error('DATABASE_URL mancante. Esegui dopo aver collegato Neon/Postgres a Vercel o in .env locale.');
  }
  const file = process.argv[2] || path.join(__dirname, '..', 'data', 'roomie-db.json');
  const db = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(databaseUrl);
  await sql`CREATE TABLE IF NOT EXISTS roomie_state (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`INSERT INTO roomie_state (id, data, updated_at)
    VALUES ('main', CAST(${JSON.stringify(db)} AS jsonb), NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
  console.log(`Migrato ${file} su Postgres: ${db.users?.length || 0} utenti, ${db.bookings?.length || 0} prenotazioni.`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
