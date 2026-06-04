// ── lib/utils.ts ──────────────────────────────────────────────────────────────
// Pure utility functions shared across API routes.

import type { Booking, DbUser, Addon, AppConfig } from './types'

export function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

export function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

export function isValidEmailString(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function addHoursToTime(time: string, hours: number): string {
  const [hh, mm] = String(time || '00:00').split(':').map(Number)
  const totalMinutes = (Number(hh || 0) * 60) + Number(mm || 0) + Number(hours || 0) * 60
  const next = ((totalMinutes % 1440) + 1440) % 1440
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function isValidTimeString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false
  const [hh, mm] = value.split(':').map(Number)
  return Number.isInteger(hh) && Number.isInteger(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59
}

function zonedParts(date: Date, timeZone = 'Europe/Rome') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value || 0)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

function localDateTimeToUtcIso(date: string, time: string, addDays = 0, timeZone = 'Europe/Rome'): string {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  let utcMs = Date.UTC(year, month - 1, day + addDays, hour, minute, 0)

  // Convert wall-clock Europe/Rome time to UTC without relying on server TZ.
  for (let i = 0; i < 2; i += 1) {
    const parts = zonedParts(new Date(utcMs), timeZone)
    const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    utcMs -= asIfUtc - Date.UTC(year, month - 1, day + addDays, hour, minute, 0)
  }

  return new Date(utcMs).toISOString()
}

export function bookingAccessUntilIso(date: string, start: string, end: string): string {
  const crossesMidnight = end <= start
  return localDateTimeToUtcIso(date, end, crossesMidnight ? 1 : 0)
}

export const ACTIVE_STATUSES: Booking['status'][] = ['confirmed', 'pending']
export const LIVE_ACCESS_STATUSES: Booking['status'][] = ['confirmed']

export function bookingStartDate(booking: Booking): Date {
  const date = booking?.date || '1970-01-01'
  const start = booking?.start || '00:00'
  const value = new Date(localDateTimeToUtcIso(date, start))
  return Number.isNaN(value.getTime()) ? new Date(0) : value
}

function bookingEndDate(booking: Booking): Date {
  const date = booking?.date || '1970-01-01'
  const start = booking?.start || '00:00'
  const end = booking?.end || '00:00'
  const value = new Date(bookingAccessUntilIso(date, start, end))
  if (Number.isNaN(value.getTime())) return new Date(0)
  return value
}

export function isBookingLiveNow(booking: Booking, now = new Date()): boolean {
  if (!LIVE_ACCESS_STATUSES.includes(booking.status)) return false
  return now >= bookingStartDate(booking) && now <= bookingEndDate(booking)
}

export function serializeBooking(booking: Booking): Booking {
  return {
    ...booking,
    lockboxCode: booking.lockboxCode || '',
    doorCode: booking.doorCode || '',
    accessValidUntil: booking.accessValidUntil || booking.end || '',
  }
}

export function serializeBookingForUser(booking: Booking, now = new Date()): Booking {
  const serialized = serializeBooking(booking)
  if (isBookingLiveNow(serialized, now)) return serialized
  return {
    ...serialized,
    lockboxCode: '',
    doorCode: '',
  }
}

export function serializeAddon(addon: Addon): Addon {
  return {
    id: addon.id,
    category: addon.category || 'featured',
    brand: addon.brand || 'ROOMIE',
    name: addon.name,
    description: addon.description || '',
    price: Number(addon.price || 0),
    status: addon.status || 'active',
    soldToday: Number(addon.soldToday || 0),
  }
}

export function calcBookingPrice(
  preset: string,
  duration: number,
  guests: number,
  cfg: Pick<AppConfig, 'hourlyPrice' | 'dayPrice' | 'guestPassPrice'>,
): number {
  const isDay = preset === 'full'
  const baseChips = isDay ? cfg.dayPrice : Math.max(1, Math.round(duration)) * cfg.hourlyPrice
  const guestChips = Math.max(0, Math.floor(guests)) * cfg.guestPassPrice
  return baseChips + guestChips
}

export async function buildDashboardSummary(user: DbUser, bookings: Booking[], addons: Addon[], config: AppConfig) {
  const now = new Date()
  const serialized = bookings.map(b => serializeBookingForUser(b, now))
  const sorted = [...serialized].sort(
    (a, b) => bookingStartDate(a).getTime() - bookingStartDate(b).getTime(),
  )
  const upcoming = sorted.filter(
    b => ACTIVE_STATUSES.includes(b.status) && bookingStartDate(b) >= now,
  )
  const currentLive = sorted.find(b => isBookingLiveNow(b, now)) || null
  const next =
    upcoming[0] ||
    sorted.find(b => ACTIVE_STATUSES.includes(b.status)) ||
    null

  const completed = serialized.filter(b => ['confirmed', 'completed'].includes(b.status))
  const monthCount = completed.filter(b => {
    const d = bookingStartDate(b)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const totalSpent = serialized.reduce((sum, b) => sum + Number(b.totalChips || 0), 0)
  const toNeon = Math.max(0, 5 - monthCount)

  const favorite = completed.reduce<Record<string, number>>((acc, b) => {
    const key = `${b.start || '20:00'}|${bookingStartDate(b).getDay()}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const favoriteKey = Object.entries(favorite).sort((a, b) => b[1] - a[1])[0]?.[0] || '20:00|5'
  const [favoriteStart, favoriteDay] = favoriteKey.split('|')

  const recommended = {
    dayIndex: Number(favoriteDay || 5),
    start: favoriteStart || '20:00',
    durationHours: 2,
    title: bookings.length ? 'Riprendi il tuo slot forte' : 'Prima sessione consigliata',
    copy: bookings.length
      ? 'Stesso ritmo del tuo gruppo, meno decisioni da prendere.'
      : 'Ranked Session da 2h: prezzo chiaro, esperienza completa, zero overthinking.',
  }

  const mission = next
    ? {
        title: 'Arriva senza attrito',
        copy: 'Codici, accesso guidato e addon sono pronti nella prossima sessione.',
        cta: 'APRI ACCESSO',
        page: 'confirm',
      }
    : user.chips >= Number(config.hourlyPrice || 12)
      ? {
          title: 'Blocca la prima serata',
          copy: 'Hai già chips per partire. Scegli preset, ora e gruppo.',
          cta: 'PRENOTA ORA',
          page: 'room',
        }
      : {
          title: 'Carica la chip',
          copy: 'Ricarica il saldo e blocca il primo slot senza uscire dal flow.',
          cta: 'RICARICA',
          page: 'token',
        }

  const recommendedAddons = [...addons]
    .filter(a => a.status === 'active')
    .sort((a, b) => Number(b.soldToday || 0) - Number(a.soldToday || 0))
    .slice(0, 3)
    .map(serializeAddon)

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email || '',
      name: user.name,
      role: user.role,
      chips: Number(user.chips || 0),
      suspended: Boolean(user.suspended),
    },
    bookings: serialized,
    next,
    nextBooking: next,
    currentLive,
    history: [...serialized]
      .sort((a, b) => bookingStartDate(b).getTime() - bookingStartDate(a).getTime())
      .slice(0, 6),
    stats: {
      totalBookings: bookings.length,
      totalSpent,
      monthCount,
      toNeon,
      chips: Number(user.chips || 0),
    },
    sessionCount: bookings.length,
    chipsSpent: totalSpent,
    mission,
    recommended,
    recommendedAddons,
  }
}
