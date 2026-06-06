'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

// Handles OAuth redirects (Google, Apple, etc.) from Clerk.
// After auth, Clerk redirects to redirectUrlComplete (/dashboard).
export default function SsoCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      continueSignUpUrl="/sign-up"
      verifyEmailAddressUrl="/sign-up"
      signInForceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    />
  )
}
