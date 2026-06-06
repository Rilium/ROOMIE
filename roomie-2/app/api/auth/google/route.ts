// Deprecated compatibility shim: auth is handled by Clerk.
export async function GET() {
  return Response.redirect(
    `${process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in'}`,
    302,
  )
}
