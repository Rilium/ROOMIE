'use client'

import { useEffect, useState } from 'react'
import { AppProvider, useApp } from '@/app/context/AppContext'
import BootLoader from '@/app/components/BootLoader'
import GlobalRoomieLoader from '@/app/components/GlobalRoomieLoader'
import AuthScreen from '@/app/components/auth/AuthScreen'
import OnboardingGate from '@/app/components/onboarding/OnboardingGate'
import Nav from '@/app/components/Nav'
import Toast from '@/app/components/ui/Toast'
import BookingPage from '@/app/components/booking/BookingPage'
import DashboardPage from '@/app/components/dashboard/DashboardPage'
import TokenPage from '@/app/components/token/TokenPage'
import ShopPage from '@/app/components/shop/ShopPage'
import ConfirmPage from '@/app/components/confirm/ConfirmPage'
import SessionPage from '@/app/components/session/SessionPage'
import AdminPage from '@/app/components/admin/AdminPage'
import LandingLegacy from '@/app/components/landing/LandingLegacy'
import Modals from '@/app/components/modals/Modals'
import { PROTECTED_PAGES, type RoomiePage } from '@/lib/routing'

type InitialAuthMode = 'login' | 'register'

function renderRoutePage(page: RoomiePage) {
  if (page === 'home') return <LandingLegacy />
  if (page === 'room') return <BookingPage />
  if (page === 'token') return <TokenPage />
  if (page === 'confirm') return <ConfirmPage />
  if (page === 'session') return <SessionPage />
  if (page === 'shop') return <ShopPage />
  if (page === 'dashboard') return <DashboardPage />
  if (page === 'admin') return <AdminPage />
  return <LandingLegacy />
}

function AppRouter({ page, authOnly = false }: { page: RoomiePage; authOnly?: boolean }) {
  const { activePage, loading, user, authTransition } = useApp()
  const [bootExpired, setBootExpired] = useState(false)
  const routePage = PROTECTED_PAGES.includes(page) && !user ? 'home' : page

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
    document.body.classList.add(`page-${routePage}`)
    document.querySelectorAll('.page').forEach(el => {
      const shouldBeActive = el.id === `page-${routePage}`
      el.classList.toggle('active', shouldBeActive)
    })
  }, [routePage, activePage])

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

      {renderRoutePage(routePage)}

      <Nav />
      <Toast />
      <Modals />
    </>
  )
}

export default function RoomieApp({
  page = 'home',
  initialAuthMode,
  authOnly = false,
}: {
  page?: RoomiePage
  initialAuthMode?: InitialAuthMode
  authOnly?: boolean
}) {
  return (
    <AppProvider initialAuthMode={initialAuthMode} initialAuthOpen={Boolean(initialAuthMode)}>
      <BootLoader />
      <AppRouter page={page} authOnly={authOnly} />
    </AppProvider>
  )
}
