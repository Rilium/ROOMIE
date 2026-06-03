// Google OAuth migrated to Clerk. Configure Google in the Clerk dashboard.
export async function GET() {
  return Response.redirect(
    `${process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in'}`,
    302,
  )
}
