'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

// Handles OAuth redirects (Google, Apple, etc.) from Clerk.
// After auth, Clerk redirects to redirectUrlComplete (/dashboard).
export default function SsoCallbackPage() {
  return <AuthenticateWithRedirectCallback />
}
