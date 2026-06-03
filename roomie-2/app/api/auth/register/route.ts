// Migrated to Clerk. Use /sign-up instead.
export async function POST() {
  return Response.json({ error: 'MIGRATED_TO_CLERK' }, { status: 410 })
}
