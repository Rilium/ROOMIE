'use client'

import { useState, useCallback, useEffect } from 'react'

interface BookingCalendarProps {
  date: string          // 'YYYY-MM-DD'
  start: string         // 'HH:MM'
  end: string           // 'HH:MM' computed by parent
  duration: number      // hours
  mode: 'now' | 'plan'
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

// ── component ──────────────────────────────────────────────────────────────────

export default function BookingCalendar({
  date, start, end, duration, mode,
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
        <div className="bc-now-pill">
          <span className="bc-now-dot" />
          <span className="bc-now-label">Entrata</span>
          <span className="bc-now-time">{nowTime}</span>
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
                return (
                  <button
                    key={day} type="button" role="gridcell"
                    aria-selected={sel}
                    aria-label={`${day} ${MONTHS_IT[viewMonth]}`}
                    className={['bc-day', past ? 'bc-past' : '', sel ? 'bc-selected' : '', tod ? 'bc-today' : ''].filter(Boolean).join(' ')}
                    disabled={past}
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
                return (
                  <button
                    key={hour} type="button" aria-pressed={sel}
                    className={['bc-slot', sel ? 'bc-slot-selected' : '', pastHour ? 'bc-slot-past' : ''].filter(Boolean).join(' ')}
                    disabled={pastHour}
                    onClick={() => onStartChange(hour)}
                  >
                    {hour}
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

    </div>
  )
}
