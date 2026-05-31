'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
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
  lockboxCode: '4729',
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

// ── PROVIDER ──────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<PublicUser | null>(null)
  const [config, setConfigState] = useState<AppConfig>(defaultConfig)
  const [activePage, setActivePage] = useState('home')
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
    Promise.all([apiMe(), apiAppConfig()]).then(([meRes, cfgRes]) => {
      if (meRes.data?.user) setUserState(meRes.data.user)
      if (cfgRes.data?.config) setConfigState(cfgRes.data.config)
      setLoading(false)

      // Parse page from URL
      const urlPage = new URLSearchParams(window.location.search).get('page')
      if (urlPage) setActivePage(urlPage)
    })
  }, [])

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

  // Expose to legacy roomie.js via window (bridge period)
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    w.__roomie_showPage = (page: string) => setActivePage(page)
    w.__roomie_showToast = (msg: string | ToastPayload) => {
      const payload = typeof msg === 'string' ? { title: msg } : msg
      setToast(payload)
    }
    w.__roomie_getUser = () => user
    // Modal bridges (called from roomie.js stubs and auth screen)
    w.openLegalDoc = (type: string) => setModalLegalDoc({ open: true, type: type as LegalDocType })
    w.openNfcModal = () => setModalNfc(true)
    w.openCodeUnlockModal = () => setModalCodeUnlock(true)
    w.openInviteModal = () => setModalInvite(true)
    w.openTokenBuyModal = (amount?: number) => setModalTokenBuy({ open: true, amount: amount ?? 20 })
    return () => {
      delete w['__roomie_showPage']
      delete w['__roomie_showToast']
      delete w['__roomie_getUser']
      delete w['openLegalDoc']
      delete w['openNfcModal']
      delete w['openCodeUnlockModal']
      delete w['openInviteModal']
      delete w['openTokenBuyModal']
    }
  }, [user])

  // ── Auth ────────────────────────────────────────────────────────────────────

  const setUser = useCallback((u: PublicUser | null) => {
    setUserState(u)
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUserState(null)
    setActivePage('home')
    setActiveSessionState(null)
    setCart([])
  }, [])

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
    // Pages that require auth
    const protectedPages = ['room', 'checkout', 'confirm', 'session', 'dashboard', 'token', 'shop']
    if (protectedPages.includes(page) && !user) {
      openAuth('login')
      return
    }
    setActivePage(page)
    window.scrollTo(0, 0)
  }, [user, openAuth])

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

  const clearCart = useCallback(() => setCart([]), [])

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
    addToCart, clearCart,
    setActiveSession,
    setConfig,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
