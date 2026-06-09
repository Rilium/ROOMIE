import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'
import { hasUsableClerkConfig } from '@/lib/clerk-config'

const isProtectedPage = createRouteMatcher([
  '/admin(.*)',
  '/confirm(.*)',
  '/dashboard(.*)',
  '/session(.*)',
  '/shop(.*)',
  '/token(.*)',
])

const handler = clerkMiddleware(async (auth, request) => {
  if (isProtectedPage(request)) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    await auth.protect({ unauthenticatedUrl: signInUrl.toString() })
  }

  return NextResponse.next()
})

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (!hasUsableClerkConfig()) return NextResponse.next()

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
