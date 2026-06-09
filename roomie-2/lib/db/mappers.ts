import type { Addon, BlockedSlot, Booking, DbUser } from '@/lib/types'

export function rowToDbUser(r: Record<string, unknown>): DbUser {
  return {
    id: String(r.id),
    username: String(r.username),
    email: r.email ? String(r.email) : undefined,
    name: String(r.name),
    role: (r.role as 'user' | 'admin') ?? 'user',
    chips: Number(r.chips ?? 0),
    passwordHash: String(r.password_hash ?? ''),
    suspended: Boolean(r.suspended ?? false),
    provider: r.provider ? String(r.provider) : undefined,
    providerId: r.provider_id ? String(r.provider_id) : undefined,
    avatar: r.avatar ? String(r.avatar) : undefined,
    termsAcceptedAt: r.terms_accepted_at ? new Date(r.terms_accepted_at as string).toISOString() : null,
    privacyAcceptedAt: r.privacy_accepted_at ? new Date(r.privacy_accepted_at as string).toISOString() : null,
    documentVerificationStatus: (r.document_verification_status as DbUser['documentVerificationStatus']) ?? 'missing',
    documentType: r.document_type ? (String(r.document_type) as DbUser['documentType']) : null,
    documentLast4: r.document_last4 ? String(r.document_last4) : null,
    documentName: r.document_name ? String(r.document_name) : null,
    documentVerifiedAt: r.document_verified_at ? new Date(r.document_verified_at as string).toISOString() : null,
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
  }
}

export function rowToBooking(r: Record<string, unknown>): Booking {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    room: String(r.room ?? 'Via Terni'),
    date: r.date ? new Date(r.date as string).toISOString().slice(0, 10) : '',
    start: String(r.start_time ?? '').slice(0, 5),
    end: String(r.end_time ?? '').slice(0, 5),
    people: Number(r.people ?? 1),
    totalChips: Number(r.total_chips ?? 0),
    status: (r.status as Booking['status']) ?? 'confirmed',
    lockboxCode: r.lockbox_code ? String(r.lockbox_code) : undefined,
    doorCode: r.door_code ? String(r.door_code) : undefined,
    accessValidUntil: r.access_valid_until ? new Date(r.access_valid_until as string).toISOString() : undefined,
    liveMode: Boolean(r.live_mode ?? false),
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
  }
}

export function rowToAddon(r: Record<string, unknown>): Addon {
  const soldDate = r.sold_today_date
    ? new Date(r.sold_today_date as string).toISOString().slice(0, 10)
    : ''
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: String(r.id),
    category: (r.category as Addon['category']) ?? 'modes',
    brand: String(r.brand ?? 'ROOMIE'),
    name: String(r.name ?? ''),
    description: String(r.description ?? ''),
    price: Number(r.price ?? 0),
    status: (r.status as Addon['status']) ?? 'active',
    soldToday: soldDate && soldDate !== today ? 0 : Number(r.sold_today ?? 0),
  }
}

export function rowToBlockedSlot(r: Record<string, unknown>): BlockedSlot {
  return {
    id: String(r.id),
    date: r.date ? new Date(r.date as string).toISOString().slice(0, 10) : '',
    start: String(r.start_time ?? '').slice(0, 5),
    end: String(r.end_time ?? '').slice(0, 5),
    reason: String(r.reason ?? ''),
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
  }
}
