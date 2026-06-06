import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'
import { hasUsableClerkPublishableKey } from '@/lib/clerk-config'

const handler = clerkMiddleware()

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (!hasUsableClerkPublishableKey()) return NextResponse.next()

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
