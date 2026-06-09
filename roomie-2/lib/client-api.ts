// ── CLIENT API ────────────────────────────────────────────────────────────────
// Typed fetch wrapper per chiamate lato client.

import type { PublicUser, Booking, Addon, AppConfig, BlockedSlot } from './types'

export interface ApiResult<T = unknown> {
  data: T | null
  error: string | null
  status: number
}

let authTokenGetter: (() => Promise<string | null>) | null = null
let pendingApiCalls = 0
const pendingListeners = new Set<(pending: number) => void>()

export function setAuthTokenGetter(getter: (() => Promise<string | null>) | null) {
  authTokenGetter = getter
}

export function subscribeApiPending(listener: (pending: number) => void) {
  pendingListeners.add(listener)
  listener(pendingApiCalls)
  return () => {
    pendingListeners.delete(listener)
  }
}

function emitApiPending(delta: 1 | -1) {
  pendingApiCalls = Math.max(0, pendingApiCalls + delta)
  pendingListeners.forEach(listener => listener(pendingApiCalls))
}

async function call<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<ApiResult<T>> {
  emitApiPending(1)
  try {
    const method = String(options?.method || 'GET').toUpperCase()
    const headers = new Headers(options?.headers)
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (!headers.has('Authorization') && authTokenGetter) {
      const token = await authTokenGetter().catch(() => null)
      if (token) headers.set('Authorization', `Bearer ${token}`)
    }
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      headers.set('X-ROOMIE-CSRF', getCsrfToken())
    }
    const res = await fetch(path, {
      ...options,
      headers,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { data: null, error: data.error || `HTTP ${res.status}`, status: res.status }
    return { data, error: null, status: res.status }
  } catch {
    return { data: null, error: 'NETWORK_ERROR', status: 0 }
  } finally {
    emitApiPending(-1)
  }
}

function getCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const existing = document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('roomie.csrf='))
    ?.split('=')[1]
  if (existing) return decodeURIComponent(existing)

  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  document.cookie = `roomie.csrf=${encodeURIComponent(token)}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
  return token
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
// Login and register are handled by Clerk (/sign-in, /sign-up).

export async function apiLogout() {
  return call('/api/auth/logout', { method: 'POST' })
}

export async function apiMe(token?: string) {
  return call<{ user: PublicUser }>('/api/me', token ? {
    headers: { Authorization: `Bearer ${token}` },
  } : undefined)
}

export async function apiAcceptLegal() {
  return call<{ user: PublicUser }>('/api/onboarding', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept_legal' }),
  })
}

export async function apiRevokeLegal() {
  return call<{ user: PublicUser }>('/api/onboarding', {
    method: 'POST',
    body: JSON.stringify({ action: 'revoke_legal' }),
  })
}

export async function apiMockVerifyDocument(payload: {
  documentType: 'id_card' | 'driver_license'
  documentLast4: string
  documentName: string
}) {
  return call<{ user: PublicUser }>('/api/onboarding', {
    method: 'POST',
    body: JSON.stringify({ action: 'mock_verify_document', ...payload }),
  })
}

export async function apiUpdateProfile(payload: { name?: string; username?: string }) {
  return call<{ user: PublicUser }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

// ── APP ───────────────────────────────────────────────────────────────────────

export async function apiAppConfig() {
  return call<{
    config: AppConfig
    blockedSlots: BlockedSlot[]
    bookedSlots: Array<{ date: string; start: string; end: string; status: string }>
  }>('/api/app/config')
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

export interface DashboardData {
  user: PublicUser
  bookings: Booking[]
  nextBooking: Booking | null
  currentLive?: Booking | null
  sessionCount: number
  chipsSpent: number
  stats?: {
    totalBookings: number
    totalSpent: number
    monthCount: number
    toNeon: number
    chips: number
  }
}

// Cache per deduplicare chiamate parallele (AppContext + DashboardPage le fanno entrambe al mount)
let _dashCache: { ts: number; p: Promise<ApiResult<DashboardData>> } | null = null
const DASH_TTL = 4000 // ms — abbastanza per coprire il doppio mount iniziale

export async function apiDashboard(force = false) {
  const now = Date.now()
  if (!force && _dashCache && now - _dashCache.ts < DASH_TTL) return _dashCache.p
  const p = call<DashboardData>('/api/dashboard')
  _dashCache = { ts: now, p }
  return p
}

export function invalidateDashboardCache() {
  _dashCache = null
}

// ── BOOKING ───────────────────────────────────────────────────────────────────

export async function apiBookingPrice(preset: string, duration: number, guests: number) {
  const q = new URLSearchParams({ preset, duration: String(duration), guests: String(guests) })
  return call<{ totalChips: number; config: AppConfig }>(`/api/bookings/price?${q}`)
}

export interface BookingPayload {
  date: string
  start: string
  end: string
  people: number
  friendIds?: string[]
  preset: string
  duration: number
  guests: number
  liveMode: boolean
  room: string
}

export async function apiCreateBooking(payload: BookingPayload) {
  return call<{ booking: Booking; user: PublicUser }>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function apiGetBookings() {
  return call<{ bookings: Booking[] }>('/api/bookings')
}

export async function apiExtendBooking(id: string) {
  return call<{ booking: Booking }>(`/api/bookings/${id}/extend`, { method: 'POST' })
}

// ── ADDONS ────────────────────────────────────────────────────────────────────

export async function apiGetAddons() {
  return call<{ addons: Addon[] }>('/api/addons')
}

export interface AddonOrderPayload {
  bookingId: string
  items: { id: string; qty: number }[]
}

export async function apiOrderAddons(payload: AddonOrderPayload) {
  return call('/api/addon-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ── ACCESS ───────────────────────────────────────────────────────────────────

export async function apiLogAccess(bookingId: string | undefined, event: string, method?: string) {
  if (!bookingId) return { data: null, error: 'NO_BOOKING', status: 0 }
  return call('/api/access/log', {
    method: 'POST',
    body: JSON.stringify({ bookingId, event, method }),
  })
}

export async function apiRoomWifi() {
  return call<{ wifi: { ssid: string; password: string; configured: boolean } }>('/api/room/wifi')
}

// ── WALLET ────────────────────────────────────────────────────────────────────

export async function apiStripeTopup(amount: number, returnPage = 'token') {
  return call<{ url: string }>('/api/stripe/topup-checkout', {
    method: 'POST',
    body: JSON.stringify({ amount, returnPage }),
  })
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────

export async function apiAdminSummary() {
  return call('/api/admin/summary')
}

export async function apiAdminPatchConfig(config: Partial<AppConfig>) {
  return call<{ config: AppConfig }>('/api/admin/config', {
    method: 'PATCH',
    body: JSON.stringify(config),
  })
}

export async function apiAdminPatchBookingStatus(id: string, status: string) {
  return call(`/api/admin/bookings/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function apiAdminPatchUserChips(id: string, delta: number, reason = 'Admin wallet adjustment') {
  return call(`/api/admin/users/${id}/chips`, {
    method: 'PATCH',
    body: JSON.stringify({ amount: delta, reason }),
  })
}

export async function apiAdminBlockSlot(date: string, start: string, end: string, reason: string) {
  return call('/api/admin/blocked-slots', {
    method: 'POST',
    body: JSON.stringify({ date, start, end, reason }),
  })
}

export async function apiAdminDeleteBlockedSlot(id: string) {
  return call(`/api/admin/blocked-slots/${id}`, { method: 'DELETE' })
}

export async function apiAdminCreateAddon(addon: Partial<Addon>) {
  return call('/api/admin/addons', {
    method: 'POST',
    body: JSON.stringify(addon),
  })
}

export async function apiAdminPatchAddon(id: string, data: Partial<Addon>) {
  return call(`/api/admin/addons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function apiAdminDeleteAddon(id: string) {
  return call(`/api/admin/addons/${id}`, { method: 'DELETE' })
}
