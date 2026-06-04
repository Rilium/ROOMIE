import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'

// Clerk runs as a session enhancer — no page redirects.
// Page auth is handled client-side by AppContext (modal).
// API auth is handled server-side by auth() in each handler.
const handler = clerkMiddleware(() => {})

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  if (!key || key.length < 30 || key.includes('YOUR_KEY')) {
    return NextResponse.next()
  }
  try {
    return await handler(request, event)
  } catch (err) {
    console.error('[clerk-middleware] error:', err)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
