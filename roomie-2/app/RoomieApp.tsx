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
import LandingLegacy from '@/app/components/landing/LandingLegacy'
import Modals from '@/app/components/modals/Modals'

export type RoomiePage = 'home' | 'room' | 'token' | 'confirm' | 'session' | 'shop' | 'dashboard' | 'admin'

const PROTECTED_PAGES: RoomiePage[] = ['room', 'token', 'confirm', 'session', 'shop', 'dashboard', 'admin']

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

function AppRouter({ page }: { page: RoomiePage }) {
  const { activePage, loading, user } = useApp()
  const routePage = PROTECTED_PAGES.includes(page) && !user ? 'home' : page

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

  if (loading) return null

  return (
    <>
      <AuthScreen />

      {renderRoutePage(routePage)}

      <Nav />
      <Toast />
      <Modals />
    </>
  )
}

export default function RoomieApp({ page = 'home' }: { page?: RoomiePage }) {
  return (
    <AppProvider>
      <BootLoader />
      <AppRouter page={page} />
    </AppProvider>
  )
}
