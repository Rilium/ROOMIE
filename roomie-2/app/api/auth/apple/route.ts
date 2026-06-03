// Apple Sign-In migrated to Clerk. Configure Apple in the Clerk dashboard.
export function GET() {
  return Response.json({ error: 'MIGRATED_TO_CLERK' }, { status: 410 })
}
