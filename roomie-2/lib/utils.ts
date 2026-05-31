// ── lib/utils.ts ──────────────────────────────────────────────────────────────
// Pure utility functions shared across API routes.

import type { Booking, DbUser, Addon, AppConfig } from './types'
import { publicUser } from './neon-db'

export function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

export function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

export function addHoursToTime(time: string, hours: number): string {
  const [hh, mm] = String(time || '00:00').split(':').map(Number)
  const totalMinutes = (Number(hh || 0) * 60) + Number(mm || 0) + Number(hours || 0) * 60
  const next = ((totalMinutes % 1440) + 1440) % 1440
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`
}

export const ACTIVE_STATUSES: Booking['status'][] = ['confirmed', 'pending']

export function bookingStartDate(booking: Booking): Date {
  const date = booking?.date || '1970-01-01'
  const start = booking?.start || '00:00'
  const value = new Date(`${date}T${start}:00`)
  return Number.isNaN(value.getTime()) ? new Date(0) : value
}

export function serializeBooking(booking: Booking): Booking {
  return {
    ...booking,
    lockboxCode: booking.lockboxCode || '',
    doorCode: booking.doorCode || '',
    accessValidUntil: booking.accessValidUntil || booking.end || '',
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
  const serialized = bookings.map(serializeBooking)
  const sorted = [...serialized].sort(
    (a, b) => bookingStartDate(a).getTime() - bookingStartDate(b).getTime(),
  )
  const upcoming = sorted.filter(
    b => ACTIVE_STATUSES.includes(b.status) && bookingStartDate(b) >= now,
  )
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
    user: publicUser(user),
    bookings: serialized,
    next,
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
    mission,
    recommended,
    recommendedAddons,
  }
}
