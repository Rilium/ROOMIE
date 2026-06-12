'use client'

import { useState, useCallback, useEffect } from 'react'

export interface CalendarBusySlot {
  date: string
  start: string
  end: string
  status?: string
  reason?: string
  source: 'booking' | 'blocked'
}

interface BookingCalendarProps {
  date: string          // 'YYYY-MM-DD'
  start: string         // 'HH:MM'
  end: string           // 'HH:MM' computed by parent
  duration: number      // hours
  mode: 'now' | 'plan'
  busySlots?: CalendarBusySlot[]
  selectedConflict?: CalendarBusySlot | null
  selectedConflictLabel?: string | null
  onDateChange: (d: string) => void
  onStartChange: (t: string) => void
  onModeChange: (m: 'now' | 'plan') => void
}

const WEEKDAYS = ['LU', 'MA', 'ME', 'GI', 'VE', 'SA', 'DO']
const MONTHS_IT = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
]
const DAYS_SHORT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

// 08:00 → 23:00, step 1h (16 chips)
const HOUR_SLOTS = Array.from({ length: 16 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`)

// ── helpers ────────────────────────────────────────────────────────────────────

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function todayYmd(): string { return ymd(new Date()) }

function displayDate(dateStr: string): string {
  const d = parseYmd(dateStr)
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function dateTime(dateStr: string, time: string, rollToNextDay = false): number {
  const d = parseYmd(dateStr)
  const mins = minutes(time)
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  if (rollToNextDay) d.setDate(d.getDate() + 1)
  return d.getTime()
}

function overlaps(candidateDate: string, candidateStart: string, candidateEnd: string, slot: CalendarBusySlot): boolean {
  const cStart = dateTime(candidateDate, candidateStart)
  const cEnd = dateTime(candidateDate, candidateEnd, minutes(candidateEnd) <= minutes(candidateStart))
  const sStart = dateTime(slot.date, slot.start)
  const sEnd = dateTime(slot.date, slot.end, minutes(slot.end) <= minutes(slot.start))
  return cStart < sEnd && cEnd > sStart
}

function busyLabel(slot?: CalendarBusySlot | null): string {
  if (!slot) return 'Disponibile'
  return slot.source === 'blocked' ? 'Bloccata' : 'Occupata'
}

// ── component ──────────────────────────────────────────────────────────────────

export default function BookingCalendar({
  date, start, end, duration, mode,
  busySlots = [],
  selectedConflict = null,
  selectedConflictLabel = null,
  onDateChange, onStartChange, onModeChange,
}: BookingCalendarProps) {
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
  const selected = parseYmd(date)

  // Which month is the calendar showing
  const [viewYear, setViewYear]   = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())

  const prevMonth = useCallback(() => {
    setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11 } return m - 1 })
  }, [])
  const nextMonth = useCallback(() => {
    setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0 } return m + 1 })
  }, [])

  // Build calendar days array (null = empty padding cell)
  const firstDay = new Date(viewYear, viewMonth, 1)
  const lastDay  = new Date(viewYear, viewMonth + 1, 0)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6 // Sunday → col 6

  const days: (number | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)

  const handleDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day)
    if (d < todayDate) return
    onDateChange(ymd(d))
    if (mode === 'now') onModeChange('plan')
  }

  // Disable past hours when today is selected
  const nowHour  = new Date().getHours()
  const isToday  = date === todayYmd()
  const planMode = mode === 'plan'
  const hasSelectedConflict = Boolean(selectedConflict || selectedConflictLabel)
  const conflictFor = useCallback((candidateDate: string, candidateStart: string, candidateEnd: string) => (
    busySlots.find(slot => overlaps(candidateDate, candidateStart, candidateEnd, slot)) ?? null
  ), [busySlots])

  const candidateEndFor = useCallback((candidateStart: string) => {
    const [h, m] = candidateStart.split(':').map(Number)
    const total = h * 60 + m + duration * 60
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }, [duration])

  const hasAnyAvailableSlot = useCallback((candidateDate: string) => (
    HOUR_SLOTS.some(hour => {
      const h = parseInt(hour)
      const isPastHour = candidateDate === todayYmd() && h <= nowHour
      return !isPastHour && !conflictFor(candidateDate, hour, candidateEndFor(hour))
    })
  ), [candidateEndFor, conflictFor, nowHour])

  // Live clock for "Adesso" pill
  const [nowTime, setNowTime] = useState(() => {
    const n = new Date()
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
  })
  useEffect(() => {
    if (mode !== 'now') return
    const id = setInterval(() => {
      const n = new Date()
      setNowTime(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`)
    }, 10000)
    return () => clearInterval(id)
  }, [mode])

  return (
    <div className="bc-wrap">

      {/* ── Mode toggle ─────────────────────────────────────────── */}
      <div className="booking-mode">
        <button
          type="button"
          className={mode === 'now' ? 'active' : ''}
          onClick={() => onModeChange('now')}
        >
          Adesso
        </button>
        <button
          type="button"
          className={mode === 'plan' ? 'active' : ''}
          onClick={() => onModeChange('plan')}
        >
          Pianifica
        </button>
      </div>

      {/* ── Adesso pill (solo in modalità now) ──────────────────── */}
      {mode === 'now' && (
        <div className={`bc-now-pill${hasSelectedConflict ? ' bc-now-pill-busy' : ''}`}>
          <span className="bc-now-dot" />
          <span className="bc-now-body">
            <span className="bc-now-label">Entra subito</span>
            <span className="bc-now-time">{displayDate(date)}</span>
            <span className="bc-now-range">{start || nowTime} → {end} · {duration}h</span>
          </span>
          <span className="bc-dur-badge">{hasSelectedConflict ? busyLabel(selectedConflict || { source: 'booking' } as CalendarBusySlot) : 'Disponibile'}</span>
        </div>
      )}

      {/* ── Calendar + slots affiancati (solo Pianifica) ─────────── */}
      {planMode && (
        <div className="bc-plan-row">

          {/* Mini calendar */}
          <div className="bc-calendar">
            <div className="bc-month-nav">
              <button type="button" className="bc-nav-btn" onClick={prevMonth} aria-label="Mese precedente">
                <i className="fas fa-chevron-left" />
              </button>
              <span className="bc-month-label">{MONTHS_IT[viewMonth]} {viewYear}</span>
              <button type="button" className="bc-nav-btn" onClick={nextMonth} aria-label="Mese successivo">
                <i className="fas fa-chevron-right" />
              </button>
            </div>
            <div className="bc-grid" role="grid" aria-label="Seleziona giorno">
              {WEEKDAYS.map(wd => (
                <span key={wd} className="bc-weekday" role="columnheader">{wd}</span>
              ))}
              {days.map((day, i) => {
                if (!day) return <span key={`e-${i}`} className="bc-day-empty" aria-hidden="true" />
                const d   = new Date(viewYear, viewMonth, day)
                const past = d < todayDate
                const sel  = ymd(d) === date
                const tod  = ymd(d) === todayYmd()
                const full = !past && !hasAnyAvailableSlot(ymd(d))
                return (
                  <button
                    key={day} type="button" role="gridcell"
                    aria-selected={sel}
                    aria-label={`${day} ${MONTHS_IT[viewMonth]}${full ? ' occupato' : ''}`}
                    className={['bc-day', past ? 'bc-past' : '', full ? 'bc-day-full' : '', sel ? 'bc-selected' : '', tod ? 'bc-today' : ''].filter(Boolean).join(' ')}
                    disabled={past || full}
                    onClick={() => handleDay(day)}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time slots */}
          <div className="bc-time-section">
            <div className="bc-time-label">
              <i className="fas fa-clock" />
              INIZIO
            </div>
            <div className="bc-slots" role="group" aria-label="Seleziona orario di inizio">
              {HOUR_SLOTS.map(hour => {
                const h        = parseInt(hour)
                const pastHour = isToday && h <= nowHour
                const sel      = start === hour
                const slotEnd  = candidateEndFor(hour)
                const conflict = conflictFor(date, hour, slotEnd)
                const disabled = pastHour || Boolean(conflict)
                return (
                  <button
                    key={hour} type="button" aria-pressed={sel}
                    aria-label={`${hour}${conflict ? ` ${busyLabel(conflict).toLowerCase()} fino alle ${conflict.end}` : ''}`}
                    title={conflict ? `${busyLabel(conflict)} ${conflict.start}-${conflict.end}` : undefined}
                    className={['bc-slot', sel ? 'bc-slot-selected' : '', pastHour ? 'bc-slot-past' : '', conflict ? 'bc-slot-busy' : ''].filter(Boolean).join(' ')}
                    disabled={disabled}
                    onClick={() => onStartChange(hour)}
                  >
                    <span>{hour}</span>
                    {conflict && <small>{busyLabel(conflict)}</small>}
                  </button>
                )
              })}
            </div>
          </div>

        </div>
      )}

      {/* ── Summary pill (solo Pianifica) ───────────────────────── */}
      {planMode && (
        <div className="bc-summary">
          <i className="fas fa-check-circle bc-summary-icon" />
          <div className="bc-summary-body">
            <span className="bc-summary-date">{displayDate(date)}</span>
            <span className="bc-summary-time">
              {start} <span className="bc-arrow">→</span> {end}
            </span>
          </div>
          <span className="bc-dur-badge">{duration}h</span>
        </div>
      )}

      {planMode && hasSelectedConflict && (
        <div className="slot-availability blocked" role="alert">
          <strong>{busyLabel(selectedConflict || { source: 'booking' } as CalendarBusySlot)} in questo orario</strong>
          <span>{selectedConflict ? `${selectedConflict.start} → ${selectedConflict.end}` : selectedConflictLabel}: scegli uno slot libero.</span>
        </div>
      )}

    </div>
  )
}
