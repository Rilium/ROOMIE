'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AppProvider, useApp } from '@/app/context/AppContext'
import BootLoader from '@/app/components/BootLoader'
import GlobalRoomieLoader from '@/app/components/GlobalRoomieLoader'
import AuthScreen from '@/app/components/auth/AuthScreen'
import OnboardingGate from '@/app/components/onboarding/OnboardingGate'
import Nav from '@/app/components/Nav'
import Toast from '@/app/components/ui/Toast'
import Modals from '@/app/components/modals/Modals'
import { PROTECTED_PAGES, type RoomiePage } from '@/lib/routing'

type InitialAuthMode = 'login' | 'register'

function AppShellContent({
  currentPage,
  authOnly = false,
  children,
}: {
  currentPage: RoomiePage
  authOnly?: boolean
  children?: ReactNode
}) {
  const { loading, user, authTransition } = useApp()
  const [bootExpired, setBootExpired] = useState(false)
  const isProtectedRoute = PROTECTED_PAGES.includes(currentPage)

  useEffect(() => {
    if (!loading) {
      setBootExpired(false)
      return
    }
    const t = setTimeout(() => {
      setBootExpired(true)
      document.body.classList.remove('app-booting')
    }, 3500)
    return () => clearTimeout(t)
  }, [loading])

  useEffect(() => {
    if (loading) return // keep app-booting until init is done
    const body = document.body
    body.classList.toggle('auth-logged-in', Boolean(user))
    body.classList.toggle('auth-logged-out', !user)
    // Short delay so boot-loader starts its fade-out before content appears (smooth crossfade)
    const t = setTimeout(() => body.classList.remove('app-booting'), 110)
    return () => clearTimeout(t)
  }, [user, loading])

  useEffect(() => {
    document.body.classList.forEach(className => {
      if (className.startsWith('page-')) document.body.classList.remove(className)
    })
    document.body.classList.add(`page-${currentPage}`)
    document.querySelectorAll('.page').forEach(el => {
      const shouldBeActive = el.id === `page-${currentPage}`
      el.classList.toggle('active', shouldBeActive)
    })
  }, [currentPage])

  if (loading && !bootExpired) return null

  if (authOnly) {
    return (
      <>
        <AuthScreen presentation="page" />
        <Toast />
        <Modals />
      </>
    )
  }

  if (isProtectedRoute && !user) return null

  return (
    <>
      <AuthScreen />
      <OnboardingGate />
      <GlobalRoomieLoader />

      {authTransition === 'logout' && (
        <div className="auth-transition-loader" role="status" aria-live="polite">
          <div className="auth-transition-card">
            <div className="auth-transition-brand">ROOMIE</div>
            <span className="roomie-chip" aria-hidden="true"></span>
            <div className="auth-transition-copy">Logout in corso</div>
            <div className="auth-transition-sub">Chiudiamo la sessione e mettiamo al sicuro il profilo.</div>
          </div>
        </div>
      )}

      {children}

      <Nav />
      <Toast />
      <Modals />
    </>
  )
}

export default function RoomieApp({
  page,
  initialAuthMode,
  authOnly = false,
  children,
}: {
  page: RoomiePage
  initialAuthMode?: InitialAuthMode
  authOnly?: boolean
  children?: ReactNode
}) {
  return (
    <AppProvider initialAuthMode={initialAuthMode} initialAuthOpen={Boolean(initialAuthMode)}>
      <BootLoader />
      <AppShellContent currentPage={page} authOnly={authOnly}>
        {children}
      </AppShellContent>
    </AppProvider>
  )
}
