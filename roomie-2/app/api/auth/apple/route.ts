// Deprecated compatibility shim: auth is handled by Clerk.
export function GET() {
  return Response.json({ error: 'MIGRATED_TO_CLERK' }, { status: 410 })
}
