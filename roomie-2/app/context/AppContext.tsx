'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import type { PublicUser, AppConfig, Booking } from '@/lib/types'
import { apiMe, apiAppConfig, apiLogout } from '@/lib/client-api'

// ── TYPES ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  id?: string
  name: string
  price: number
  qty: number
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
  toast: ToastPayload | null
  booking: BookingDraft
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
const CART_STORAGE_KEY = 'roomie.cart.v1'
const CART_TTL_MS = 1000 * 60 * 60 * 4
const PAGE_TO_PATH: Record<string, string> = {
  home: '/',
  room: '/room',
  token: '/token',
  confirm: '/confirm',
  session: '/session',
  shop: '/shop',
  dashboard: '/dashboard',
  admin: '/admin',
}
const PATH_TO_PAGE: Record<string, string> = Object.fromEntries(
  Object.entries(PAGE_TO_PATH).map(([page, path]) => [path, page])
)
const PROTECTED_PAGES = ['room', 'checkout', 'confirm', 'session', 'dashboard', 'token', 'shop', 'admin']

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

// ── PROVIDER ──────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { signOut: clerkSignOut } = useClerk()
  const [user, setUserState] = useState<PublicUser | null>(null)
  const userRef = useRef<PublicUser | null>(null)
  const [config, setConfigState] = useState<AppConfig>(defaultConfig)
  const [activePage, setActivePage] = useState(() => PATH_TO_PAGE[pathname || '/'] || 'home')
  const [authMode, setAuthModeState] = useState<'login' | 'register'>('login')
  const [authOpen, setAuthOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const [booking, setBookingState] = useState<BookingDraft>(defaultBooking)
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Modal state
  const [modalNfc, setModalNfc] = useState(false)
  const [modalCodeUnlock, setModalCodeUnlock] = useState(false)
  const [modalTokenBuy, setModalTokenBuy] = useState<{ open: boolean; amount: number }>({ open: false, amount: 20 })
  const [modalLegalDoc, setModalLegalDoc] = useState<{ open: boolean; type: LegalDocType | null }>({ open: false, type: null })
  const [modalInvite, setModalInvite] = useState(false)

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true
    const init = async () => {
      let roomieUser: PublicUser | null = null
      try {
        const [meRes, cfgRes] = await Promise.all([apiMe(), apiAppConfig()])
        if (!mounted) return
        roomieUser = meRes.data?.user || null
        if (roomieUser) {
          userRef.current = roomieUser
          setUserState(roomieUser)
        }
        if (cfgRes.data?.config) setConfigState(cfgRes.data.config)
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
          if (PROTECTED_PAGES.includes(routePage) && !roomieUser) {
            setAuthModeState('login')
            setAuthOpen(true)
            setActivePage('home')
          } else {
            setActivePage(routePage)
          }
        }
        setLoading(false)
      }
    }
    init()
    return () => { mounted = false }
  }, [router])

  useEffect(() => {
    const page = PATH_TO_PAGE[pathname || '/'] || 'home'
    if (PROTECTED_PAGES.includes(page) && !userRef.current && !loading) {
      setAuthModeState('login')
      setAuthOpen(true)
      setActivePage('home')
      return
    }
    setActivePage(page)
  }, [pathname, loading])

  // Modal handlers
  const openModalNfc = useCallback(() => setModalNfc(true), [])
  const openModalCodeUnlock = useCallback(() => setModalCodeUnlock(true), [])
  const openModalTokenBuy = useCallback((amount: number) => setModalTokenBuy({ open: true, amount }), [])
  const openLegalDoc = useCallback((type: LegalDocType) => setModalLegalDoc({ open: true, type }), [])
  const openModalInvite = useCallback(() => setModalInvite(true), [])
  const closeModal = useCallback((name: 'nfc' | 'codeUnlock' | 'tokenBuy' | 'legalDoc' | 'invite') => {
    if (name === 'nfc') setModalNfc(false)
    else if (name === 'codeUnlock') setModalCodeUnlock(false)
    else if (name === 'tokenBuy') setModalTokenBuy(p => ({ ...p, open: false }))
    else if (name === 'legalDoc') setModalLegalDoc(p => ({ ...p, open: false }))
    else if (name === 'invite') setModalInvite(false)
  }, [])

  // ── Bridge legacy roomie.js → React ────────────────────────────────────────
  // ATTENZIONE: questi bridge sono ancora necessari perché public/assets/js/roomie.js
  // chiama window.__roomie_showPage, window.__roomie_showToast, openInviteModal ecc.
  // Non rimuovere finché roomie.js non è completamente migrato a React.
  // TODO: dopo migrazione roomie.js → eliminare questo blocco intero.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    w.__roomie_showPage = (page: string) => {
      if (PAGE_TO_PATH[page]) router.push(PAGE_TO_PATH[page])
      else setActivePage(page)
    }
    w.__roomie_showToast = (msg: string | ToastPayload) => {
      const payload = typeof msg === 'string' ? { title: msg } : msg
      setToast(payload)
    }
    w.__roomie_getUser = () => userRef.current
    // Modal bridges (chiamati da roomie.js: openLegalDoc, openInviteModal)
    w.openLegalDoc = (type: string) => setModalLegalDoc({ open: true, type: type as LegalDocType })
    w.openNfcModal = () => setModalNfc(true)
    w.openCodeUnlockModal = () => setModalCodeUnlock(true)
    w.openInviteModal = () => setModalInvite(true)
    w.openTokenBuyModal = (amount?: number) => setModalTokenBuy({ open: true, amount: amount ?? 20 })
    return () => {
      ;[
        '__roomie_showPage',
        '__roomie_showToast',
        '__roomie_getUser',
        'openLegalDoc',
        'openNfcModal',
        'openCodeUnlockModal',
        'openInviteModal',
        'openTokenBuyModal',
      ].forEach(key => { w[key] = undefined })
    }
  }, [router])

  // ── Auth ────────────────────────────────────────────────────────────────────

  const setUser = useCallback((u: PublicUser | null) => {
    userRef.current = u
    setUserState(u)
  }, [])

  const logout = useCallback(async () => {
    try { await apiLogout() } catch {}
    userRef.current = null
    setUserState(null)
    setActivePage('home')
    setActiveSessionState(null)
    setCart([])
    try {
      await clerkSignOut({ redirectUrl: '/' })
    } catch {
      router.push('/')
    }
  }, [clerkSignOut, router])

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
    if (PROTECTED_PAGES.includes(page) && !userRef.current) {
      openAuth('login')
      return
    }
    const path = PAGE_TO_PATH[page] || '/'
    setActivePage(page)
    router.push(path)
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
  }, [openAuth, router])

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string | ToastPayload) => {
    const payload = typeof msg === 'string' ? { title: msg } : msg
    setToast(payload)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3200)
  }, [])

  // ── Booking ───────────────────────────────────────────────────────────────

  const setBookingDraft = useCallback((updates: Partial<BookingDraft>) => {
    setBookingState(prev => ({ ...prev, ...updates }))
  }, [])

  const clearBookingDraft = useCallback(() => {
    setBookingState(defaultBooking)
  }, [])

  // ── Cart ──────────────────────────────────────────────────────────────────

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.name === item.name)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + (item.qty || 1) }
        return next
      }
      return [...prev, { ...item, qty: item.qty || 1 }]
    })
  }, [])

  const updateCartItem = useCallback((name: string, delta: number) => {
    setCart(prev => prev.flatMap(item => {
      if (item.name !== name) return [item]
      const qty = Math.max(0, item.qty + delta)
      return qty > 0 ? [{ ...item, qty }] : []
    }))
  }, [])

  const removeCartItem = useCallback((name: string) => {
    setCart(prev => prev.filter(item => item.name !== name))
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { expiresAt?: number; items?: CartItem[] }
      if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
        localStorage.removeItem(CART_STORAGE_KEY)
        return
      }
      if (Array.isArray(parsed.items)) setCart(parsed.items)
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    try {
      if (!cart.length) {
        localStorage.removeItem(CART_STORAGE_KEY)
        return
      }
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
        expiresAt: Date.now() + CART_TTL_MS,
        items: cart,
      }))
    } catch {
      // localStorage is best-effort only.
    }
  }, [cart])

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
    user, config, activePage, authMode, authOpen, loading, toast,
    booking, cart, activeSession,
    modalNfc, modalCodeUnlock, modalTokenBuy, modalLegalDoc, modalInvite,
    openModalNfc, openModalCodeUnlock, openModalTokenBuy, openLegalDoc, openModalInvite, closeModal,
    setUser, logout, openAuth, closeAuth, setAuthMode,
    showPage,
    showToast,
    setBookingDraft, clearBookingDraft,
    addToCart, updateCartItem, removeCartItem, clearCart,
    setActiveSession,
    setConfig,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
