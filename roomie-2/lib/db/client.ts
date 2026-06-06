import { neon } from '@neondatabase/serverless'

export function databaseUrl() {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return url
}

export function sqlClient() {
  return neon(databaseUrl())
}
