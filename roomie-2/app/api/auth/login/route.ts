// Deprecated compatibility shim: auth is handled by Clerk.
export async function POST() {
  return Response.json({ error: 'MIGRATED_TO_CLERK' }, { status: 410 })
}
