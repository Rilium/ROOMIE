// ── TYPES ─────────────────────────────────────────────────────────────────────
// Identical to the contracts used in the original server.js

export interface PublicUser {
  id: string
  username: string
  email: string
  name: string
  role: 'user' | 'admin'
  chips: number
  suspended: boolean
  termsAcceptedAt?: string | null
  privacyAcceptedAt?: string | null
  documentVerificationStatus?: 'missing' | 'pending' | 'mock_verified' | 'verified' | 'rejected'
  documentType?: 'id_card' | 'driver_license' | null
  documentLast4?: string | null
  documentName?: string | null
  documentVerifiedAt?: string | null
}

export interface AppConfig {
  hourlyPrice: number   // default 12
  dayPrice: number      // default 60
  guestPassPrice: number // default 2
  maxPeople: number     // default 8
  lockboxCode: string
}

export interface Booking {
  id: string
  userId: string
  room: string
  date: string          // YYYY-MM-DD
  start: string         // HH:MM
  end: string           // HH:MM
  people: number
  totalChips: number
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled'
  lockboxCode?: string
  doorCode?: string
  accessValidUntil?: string
  liveMode?: boolean
  createdAt: string
}

export interface Addon {
  id: string
  category: 'featured' | 'modes' | 'snacks'
  brand: string
  name: string
  description: string
  price: number
  status: 'active' | 'soldout' | 'hidden' | 'deleted'
  soldToday: number
}

export interface BlockedSlot {
  id: string
  date: string
  start: string
  end: string
  reason: string
  createdAt: string
}

export interface StripeSession {
  id: string
  userId: string
  amount: number
  paymentIntent: string
  createdAt: string
}

export interface AddonOrder {
  id: string
  userId: string
  bookingId: string
  items: Array<{
    id: string
    name: string
    brand: string
    price: number
    qty: number
    total: number
  }>
  totalChips: number
  status: 'paid'
  createdAt: string
}

export interface AuditEntry {
  id: string
  type: string
  userId: string
  details: Record<string, unknown>
  createdAt: string
}

export interface DbUser {
  id: string
  username: string
  email?: string
  name: string
  role: 'user' | 'admin'
  chips: number
  passwordHash: string
  suspended?: boolean
  provider?: string
  providerId?: string
  avatar?: string
  termsAcceptedAt?: string | null
  privacyAcceptedAt?: string | null
  documentVerificationStatus?: 'missing' | 'pending' | 'mock_verified' | 'verified' | 'rejected'
  documentType?: 'id_card' | 'driver_license' | null
  documentLast4?: string | null
  documentName?: string | null
  documentVerifiedAt?: string | null
  createdAt: string
}

export interface SessionPayload {
  userId?: string
  oauthState?: string
  exp?: number
}
