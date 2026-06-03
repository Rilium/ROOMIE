// Handled by Clerk. Legacy callback no longer active.
export async function GET() {
  return Response.json({ error: 'MIGRATED_TO_CLERK' }, { status: 410 })
}
