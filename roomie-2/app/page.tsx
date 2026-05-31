'use client'

import { useEffect } from 'react'
import { AppProvider, useApp } from '@/app/context/AppContext'
import BootLoader from '@/app/components/BootLoader'
import AuthScreen from '@/app/components/auth/AuthScreen'
import Nav from '@/app/components/Nav'
import Toast from '@/app/components/ui/Toast'
import BookingPage from '@/app/components/booking/BookingPage'
import DashboardPage from '@/app/components/dashboard/DashboardPage'
import TokenPage from '@/app/components/token/TokenPage'
import ShopPage from '@/app/components/shop/ShopPage'
import ConfirmPage from '@/app/components/confirm/ConfirmPage'
import SessionPage from '@/app/components/session/SessionPage'
import AdminPage from '@/app/components/admin/AdminPage'

// ── LANDING ────────────────────────────────────────────────────────────────────
import LandingLegacy from '@/app/components/landing/LandingLegacy'
import Modals from '@/app/components/modals/Modals'

// ── ROUTER ────────────────────────────────────────────────────────────────────

function AppRouter() {
  const { activePage, loading, user } = useApp()

  // Sync body classes for legacy roomie.js compatibility
  useEffect(() => {
    const body = document.body
    body.classList.toggle('auth-logged-in', Boolean(user))
    body.classList.toggle('auth-logged-out', !user)
    body.classList.remove('app-booting')
  }, [user])

  // Sync active page class for legacy CSS
  useEffect(() => {
    document.querySelectorAll('.page').forEach(el => {
      const id = el.id
      const shouldBeActive = id === `page-${activePage}`
      el.classList.toggle('active', shouldBeActive)
    })
  }, [activePage])

  if (loading) return null

  return (
    <>
      <AuthScreen />

      {activePage === 'home' && <LandingLegacy />}
      {activePage === 'room' && <BookingPage />}
      {activePage === 'token' && <TokenPage />}
      {activePage === 'confirm' && <ConfirmPage />}
      {activePage === 'session' && <SessionPage />}
      {activePage === 'shop' && <ShopPage />}
      {activePage === 'dashboard' && <DashboardPage />}
      {activePage === 'admin' && <AdminPage />}

      <Nav />
      <Toast />
      <Modals />
    </>
  )
}


// ── ROOT ──────────────────────────────────────────────────────────────────────

export default function RoomiePage() {
  return (
    <AppProvider>
      <BootLoader />
      <AppRouter />
    </AppProvider>
  )
}
