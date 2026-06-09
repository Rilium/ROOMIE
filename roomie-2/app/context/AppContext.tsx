'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth, useClerk } from '@clerk/nextjs'
import type { PublicUser, AppConfig, Booking } from '@/lib/types'
import { apiMe, apiAppConfig, apiDashboard, apiLogout, setAuthTokenGetter } from '@/lib/client-api'
import { PAGE_TO_PATH, PATH_TO_PAGE, PROTECTED_PAGES } from '@/lib/routing'
import { isBookingLiveNow } from '@/lib/utils'
import { useCartState } from '@/app/context/state/useCartState'
import { useUiState } from '@/app/context/state/useUiState'
import { useBookingDraftState } from '@/app/context/state/useBookingDraftState'
import { useLegacyRoomieBridge } from '@/app/context/state/useLegacyRoomieBridge'

// ── TYPES ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  id?: string
  name: string
  price: number
  qty: number
}

export interface InvitedFriend {
  id: string
  username: string
  name: string
  meta?: string
  avatar?: string
  source?: string
}

export interface BookingDraft {
  preset: string
  duration: number
  date: string
  start: string
  end: string
  guests: number
  friends: string[]
  liveMode: boolean
  totalChips: number
  totalEur: number
  room: string
  step: number
}

export interface ActiveSession {
  booking: Booking
  friends?: InvitedFriend[]
  accessStep: number
  shutterDone: boolean
  keyDone: boolean
  doorDone: boolean
}

export interface ToastPayload {
  title: string
  copy?: string
  type?: 'warn' | 'ok'
}

export type LegalDocType = 'terms' | 'privacy' | 'cookie'

interface AppContextValue {
  // State
  user: PublicUser | null
  config: AppConfig
  activePage: string
  authMode: 'login' | 'register'
  authOpen: boolean
  loading: boolean
  authTransition: 'logout' | null
  toast: ToastPayload | null
  booking: BookingDraft
  invitedFriends: InvitedFriend[]
  cart: CartItem[]
  activeSession: ActiveSession | null

  // Modals
  modalNfc: boolean
  modalCodeUnlock: boolean
  modalTokenBuy: { open: boolean; amount: number }
  modalLegalDoc: { open: boolean; type: LegalDocType | null }
  modalInvite: boolean
  openModalNfc: () => void
  openModalCodeUnlock: () => void
  openModalTokenBuy: (amount: number) => void
  openLegalDoc: (type: LegalDocType) => void
  openModalInvite: () => void
  closeModal: (name: 'nfc' | 'codeUnlock' | 'tokenBuy' | 'legalDoc' | 'invite') => void

  // Auth
  setUser: (u: PublicUser | null) => void
  logout: () => Promise<void>
  openAuth: (mode?: 'login' | 'register') => void
  closeAuth: () => void
  setAuthMode: (m: 'login' | 'register') => void

  // Navigation
  showPage: (page: string) => void

  // Toast
  showToast: (msg: string | ToastPayload) => void

  // Booking
  setBookingDraft: (b: Partial<BookingDraft>) => void
  addInvitedFriends: (friends: InvitedFriend[]) => void
  removeInvitedFriend: (id: string) => void
  clearBookingDraft: () => void

  // Cart
  addToCart: (item: CartItem) => void
  updateCartItem: (name: string, delta: number) => void
  removeCartItem: (name: string) => void
  clearCart: () => void

  // Session
  setActiveSession: (s: ActiveSession | null) => void

  // Config
  setConfig: (c: AppConfig) => void
}

// ── DEFAULTS ──────────────────────────────────────────────────────────────────

const defaultConfig: AppConfig = {
  hourlyPrice: 12,
  dayPrice: 60,
  guestPassPrice: 2,
  maxPeople: 8,
  lockboxCode: '',
}

const defaultBooking: BookingDraft = {
  preset: 'ranked',
  duration: 2,
  date: '',
  start: '20:00',
  end: '22:00',
  guests: 0,
  friends: [],
  liveMode: false,
  totalChips: 24,
  totalEur: 24,
  room: 'Via Terni',
  step: 0,
}

// ── CONTEXT ───────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

export function useAppAuth() {
  const { user, authMode, authOpen, loading, authTransition, setUser, logout, openAuth, closeAuth, setAuthMode } = useApp()
  return { user, authMode, authOpen, loading, authTransition, setUser, logout, openAuth, closeAuth, setAuthMode }
}

export function useAppBooking() {
  const { booking, invitedFriends, setBookingDraft, addInvitedFriends, removeInvitedFriend, clearBookingDraft } = useApp()
  return { booking, invitedFriends, setBookingDraft, addInvitedFriends, removeInvitedFriend, clearBookingDraft }
}

export function useAppCart() {
  const { cart, addToCart, updateCartItem, removeCartItem, clearCart } = useApp()
  return { cart, addToCart, updateCartItem, removeCartItem, clearCart }
}

export function useAppUi() {
  const {
    activePage, toast,
    modalNfc, modalCodeUnlock, modalTokenBuy, modalLegalDoc, modalInvite,
    showPage, showToast,
    openModalNfc, openModalCodeUnlock, openModalTokenBuy, openLegalDoc, openModalInvite, closeModal,
  } = useApp()
  return {
    activePage, toast,
    modalNfc, modalCodeUnlock, modalTokenBuy, modalLegalDoc, modalInvite,
    showPage, showToast,
    openModalNfc, openModalCodeUnlock, openModalTokenBuy, openLegalDoc, openModalInvite, closeModal,
  }
}

export function useAppSession() {
  const { activeSession, setActiveSession } = useApp()
  return { activeSession, setActiveSession }
}

// ── PROVIDER ──────────────────────────────────────────────────────────────────

export function AppProvider({
  children,
  initialAuthMode = 'login',
  initialAuthOpen = false,
}: {
  children: React.ReactNode
  initialAuthMode?: 'login' | 'register'
  initialAuthOpen?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { signOut: clerkSignOut } = useClerk()
  const { isLoaded: clerkLoaded, isSignedIn, getToken } = useAuth()
  const [user, setUserState] = useState<PublicUser | null>(null)
  const userRef = useRef<PublicUser | null>(null)
  const [config, setConfigState] = useState<AppConfig>(defaultConfig)
  const [activePage, setActivePage] = useState(() => PATH_TO_PAGE[pathname || '/'] || 'home')
  const [authMode, setAuthModeState] = useState<'login' | 'register'>(initialAuthMode)
  const [authOpen, setAuthOpen] = useState(initialAuthOpen)
  const [loading, setLoading] = useState(true)
  const [authTransition, setAuthTransition] = useState<'logout' | null>(null)
  const { cart, setCart, addToCart, updateCartItem, removeCartItem, clearCart } = useCartState()
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null)
  const {
    booking,
    invitedFriends,
    setBookingDraft,
    addInvitedFriends,
    removeInvitedFriend,
    clearBookingDraft,
  } = useBookingDraftState(defaultBooking, setActiveSessionState)
  const {
    toast,
    modalNfc,
    modalCodeUnlock,
    modalTokenBuy,
    modalLegalDoc,
    modalInvite,
    showToast,
    openModalNfc,
    openModalCodeUnlock,
    openModalTokenBuy,
    openLegalDoc,
    openModalInvite,
    closeModal,
  } = useUiState()

  useEffect(() => {
    if (!clerkLoaded || !isSignedIn) {
      setAuthTokenGetter(null)
      return
    }
    setAuthTokenGetter(() => getToken())
    return () => setAuthTokenGetter(null)
  }, [clerkLoaded, isSignedIn, getToken])

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!clerkLoaded) return

    let mounted = true
    const init = async () => {
      let roomieUser: PublicUser | null = null
      try {
        const token = isSignedIn ? await getToken().catch(() => null) : null
        const [meRes, cfgRes] = await Promise.all([apiMe(token ?? undefined), apiAppConfig()])
        if (!mounted) return
        roomieUser = meRes.data?.user || null
        if (cfgRes.data?.config) setConfigState(cfgRes.data.config)

        // If landing on a protected page without a user (e.g. after OAuth redirect),
        // retry apiMe a few times — Clerk session cookie may need a moment to propagate.
        if (!roomieUser && PROTECTED_PAGES.includes(PATH_TO_PAGE[window.location.pathname] || '')) {
          for (let i = 0; i < 4; i++) {
            if (!mounted) return
            await new Promise(r => setTimeout(r, 600 + i * 400))
            const retryToken = isSignedIn ? await getToken().catch(() => null) : null
            const retry = await apiMe(retryToken ?? undefined)
            roomieUser = retry.data?.user || null
            if (roomieUser) break
          }
        }

        if (!mounted) return
        if (roomieUser) {
          userRef.current = roomieUser
          setUserState(roomieUser)
        }
      } catch (err) {
        console.error('[app:init] failed', err)
      } finally {
        if (!mounted) return
        const params = new URLSearchParams(window.location.search)
        const legacyPage = params.get('page')
        const routePage = PATH_TO_PAGE[window.location.pathname] || legacyPage || 'home'
        if (legacyPage && PAGE_TO_PATH[legacyPage]) {
          router.replace(PAGE_TO_PATH[legacyPage] + (params.toString().replace(/^page=[^&]*&?/, '') ? `?${params.toString().replace(/^page=[^&]*&?/, '')}` : ''))
        }
        if (routePage) {
          setActivePage(routePage)
          if (PROTECTED_PAGES.includes(routePage) && !roomieUser) {
            setAuthOpen(false)
            if (!isSignedIn) {
              const next = PAGE_TO_PATH[routePage] || window.location.pathname
              router.replace(`/sign-in?next=${encodeURIComponent(next)}`)
            }
          }
        }
        setLoading(false)
      }
    }
    init()
    return () => { mounted = false }
  }, [router, clerkLoaded, isSignedIn, getToken])

  useEffect(() => {
    if (!clerkLoaded) return

    const page = PATH_TO_PAGE[pathname || '/'] || 'home'
    setActivePage(page)
    if (PROTECTED_PAGES.includes(page) && !userRef.current && !loading && !isSignedIn) {
      setAuthOpen(false)
      const path = PAGE_TO_PATH[page] || pathname || '/'
      router.replace(`/sign-in?next=${encodeURIComponent(path)}`)
      return
    }
  }, [pathname, loading, clerkLoaded, isSignedIn, router])

  useEffect(() => {
    if (!user) {
      setActiveSessionState(null)
      return
    }
    let mounted = true
    apiDashboard().then(({ data }) => {
      if (!mounted) return
      const liveBooking = data?.currentLive || null
      setActiveSessionState(prev => {
        if (liveBooking) {
          const sameBooking = prev?.booking.id === liveBooking.id
          return {
            booking: liveBooking,
            friends: sameBooking ? prev?.friends : invitedFriends,
            accessStep: sameBooking ? prev.accessStep : 0,
            shutterDone: sameBooking ? prev.shutterDone : false,
            keyDone: sameBooking ? prev.keyDone : false,
            doorDone: sameBooking ? prev.doorDone : false,
          }
        }
        if (prev?.booking && isBookingLiveNow(prev.booking)) return prev
        return null
      })
    }).catch(() => {})
    return () => { mounted = false }
  }, [user, invitedFriends])

  const navigateToPage = useCallback((page: string) => {
    const path = PAGE_TO_PATH[page] || '/'
    if (PROTECTED_PAGES.includes(page) && !userRef.current) {
      router.push(`/sign-in?next=${encodeURIComponent(path)}`)
      return
    }
    router.push(path)
  }, [router])

  useLegacyRoomieBridge({
    navigateToPage,
    showToast,
    openLegalDoc,
    openModalNfc,
    openModalCodeUnlock,
    openModalInvite,
    openModalTokenBuy,
    userRef,
  })

  // ── Auth ────────────────────────────────────────────────────────────────────

  const setUser = useCallback((u: PublicUser | null) => {
    userRef.current = u
    setUserState(u)
  }, [])

  const logout = useCallback(async () => {
    setAuthTransition('logout')
    setAuthOpen(false)
    try { await apiLogout() } catch {}
    try {
      await clerkSignOut({ redirectUrl: '/' })
    } catch {
      userRef.current = null
      setUserState(null)
      setActivePage('home')
      setActiveSessionState(null)
      setCart([])
      setAuthTransition(null)
      router.push('/')
    }
  }, [clerkSignOut, router, setCart])

  const openAuth = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthModeState(mode)
    setAuthOpen(true)
  }, [])

  const closeAuth = useCallback(() => {
    setAuthOpen(false)
  }, [])

  const setAuthMode = useCallback((m: 'login' | 'register') => {
    setAuthModeState(m)
  }, [])


  // ── Navigation ───────────────────────────────────────────────────────────────

  const showPage = useCallback((page: string) => {
    navigateToPage(page)
    window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    }, 90)
  }, [navigateToPage])

  // ── Session ───────────────────────────────────────────────────────────────

  const setActiveSession = useCallback((s: ActiveSession | null) => {
    setActiveSessionState(s)
  }, [])

  // ── Config ────────────────────────────────────────────────────────────────

  const setConfig = useCallback((c: AppConfig) => {
    setConfigState(c)
  }, [])

  // ── Value ──────────────────────────────────────────────────────────────────

  const value: AppContextValue = {
    user, config, activePage, authMode, authOpen, loading, authTransition, toast,
    booking, invitedFriends, cart, activeSession,
    modalNfc, modalCodeUnlock, modalTokenBuy, modalLegalDoc, modalInvite,
    openModalNfc, openModalCodeUnlock, openModalTokenBuy, openLegalDoc, openModalInvite, closeModal,
    setUser, logout, openAuth, closeAuth, setAuthMode,
    showPage,
    showToast,
    setBookingDraft, addInvitedFriends, removeInvitedFriend, clearBookingDraft,
    addToCart, updateCartItem, removeCartItem, clearCart,
    setActiveSession,
    setConfig,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
