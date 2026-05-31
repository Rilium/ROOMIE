import { neon } from '@neondatabase/serverless'

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  ''

export async function GET() {
  if (!DATABASE_URL) {
    return Response.json(
      {
        driver: 'none',
        persistent: false,
        configured: false,
        error: 'STORAGE_NOT_CONFIGURED',
      },
      { status: 503 },
    )
  }
  try {
    const sql = neon(DATABASE_URL)
    const [usersRow, bookingsRow] = await Promise.all([
      sql`SELECT COUNT(*) AS count FROM users`,
      sql`SELECT COUNT(*) AS count FROM bookings`,
    ])
    return Response.json({
      driver: 'postgres',
      persistent: true,
      configured: true,
      users: Number(usersRow[0]?.count ?? 0),
      bookings: Number(bookingsRow[0]?.count ?? 0),
      updatedAt: new Date().toISOString(),
    })
  } catch (_err) {
    return Response.json(
      {
        driver: 'postgres',
        persistent: true,
        error: 'STORAGE_UNAVAILABLE',
      },
      { status: 500 },
    )
  }
}
