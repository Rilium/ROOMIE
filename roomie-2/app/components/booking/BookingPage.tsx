'use client'

import { useState, useCallback, useEffect } from 'react'
import { useApp } from '@/app/context/AppContext'
import { apiCreateBooking, apiBookingPrice } from '@/lib/client-api'

interface Preset {
  id: string
  label: string
  icon: string
  sub: string
  duration: number
  chips: number
  defaultStart: string
  isDay?: boolean
}

const PRESETS: Preset[] = [
  { id: 'quick', label: 'Quick Match', icon: 'fa-bolt', sub: '1h · da adesso · botta veloce', duration: 1, chips: 12, defaultStart: '18:00' },
  { id: 'ranked', label: 'Ranked Session', icon: 'fa-gamepad', sub: '2h · valore migliore · già selezionata', duration: 2, chips: 24, defaultStart: '20:00' },
  { id: 'movie', label: 'Movie Night', icon: 'fa-film', sub: '3h · ore 20:00 · divano e schermo pieno', duration: 3, chips: 36, defaultStart: '20:00' },
  { id: 'full', label: 'Full Experience', icon: 'fa-trophy', sub: 'Giornata · 09:00→23:00 · tutto tuo', duration: 14, chips: 60, defaultStart: '09:00', isDay: true },
]

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + hours * 60
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function todayDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function BookingPage() {
  const { user, config, setUser, setBookingDraft, showPage, showToast, activePage } = useApp()

  const [step, setStep] = useState(0)
  const [preset, setPresetState] = useState<Preset>(PRESETS[1])
  const [duration, setDuration] = useState(2)
  const [date, setDate] = useState(todayDate())
  const [start, setStart] = useState('20:00')
  const [guests, setGuests] = useState(0)
  const [liveMode, setLiveMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'now' | 'plan'>('plan')
  // serverPrice: fetched from /api/bookings/price; falls back to local estimate
  const [serverPrice, setServerPrice] = useState<number | null>(null)

  const end = addHours(start, duration)
  // Local estimate (shown while server confirms)
  const baseChips = preset.isDay ? config.dayPrice : duration * config.hourlyPrice
  const guestChips = guests * config.guestPassPrice
  const totalChips = serverPrice ?? (baseChips + guestChips)
  const cashback = Math.floor(totalChips * 0.5)
  const balance = user?.chips ?? 0

  // Fetch server-side price whenever booking params change
  useEffect(() => {
    let cancelled = false
    apiBookingPrice(preset.id, duration, guests).then(({ data }) => {
      if (!cancelled && data?.totalChips != null) setServerPrice(data.totalChips)
    })
    return () => { cancelled = true }
  }, [preset.id, duration, guests])

  // Reset step when page changes to room
  useEffect(() => {
    if (activePage === 'room') setStep(0)
  }, [activePage])

  // Sync draft to context whenever booking changes
  useEffect(() => {
    setBookingDraft({
      preset: preset.id,
      duration,
      date,
      start,
      end,
      guests,
      liveMode,
      totalChips,
      totalEur: totalChips,
      room: 'Via Terni',
      step,
    })
  }, [preset, duration, date, start, guests, liveMode, totalChips, step, setBookingDraft, end])

  const selectPreset = useCallback((p: Preset) => {
    setPresetState(p)
    setDuration(p.duration)
    setStart(p.defaultStart)
  }, [])

  const setDur = useCallback((h: number) => {
    setDuration(h)
    setPresetState(prev => ({ ...prev, isDay: false }))
  }, [])

  const adjustGuests = useCallback((delta: number) => {
    setGuests(prev => Math.max(0, Math.min(config.maxPeople - 1, prev + delta)))
  }, [config.maxPeople])

  const goNext = useCallback(() => {
    if (step === 3) return
    setStep(s => s + 1)
  }, [step])

  const goPrev = useCallback(() => {
    if (step === 0) { showPage('home'); return }
    setStep(s => s - 1)
  }, [step, showPage])

  const handleConfirm = useCallback(async () => {
    if (balance < totalChips) {
      showToast({ title: 'Saldo insufficiente', copy: 'Ricarica chips prima di procedere.', type: 'warn' })
      showPage('token')
      return
    }
    setBusy(true)
    const { data, error } = await apiCreateBooking({
      date,
      start,
      end,
      people: 1 + guests,
      preset: preset.id,
      duration,
      guests,
      liveMode,
      room: 'Via Terni',
    })
    setBusy(false)
    if (error || !data?.booking) {
      const msgs: Record<string, string> = {
        INSUFFICIENT_CHIPS: 'Chips insufficienti. Ricarica e riprova.',
        SLOT_BLOCKED: 'Slot già occupato, scegli un altro orario.',
        BAD_BOOKING_DATE: 'Data non valida.',
        BAD_BOOKING_TIME: 'Orario non valido.',
        BAD_PEOPLE: `Troppi partecipanti (max ${config.maxPeople}).`,
      }
      showToast({ title: msgs[error || ''] || 'Errore prenotazione.', type: 'warn' })
      return
    }
    // Update context with server-confirmed booking + updated user chips
    if (data.user) setUser(data.user)
    setBookingDraft({ ...data.booking as any })
    showToast({ title: 'Prenotazione confermata!' })
    showPage('confirm')
  }, [balance, totalChips, preset, duration, date, start, end, guests, liveMode, config.maxPeople, setUser, setBookingDraft, showPage, showToast])

  const stepLabels = ['Sessione', 'Quando', 'Gruppo', 'Riepilogo']

  return (
    <div className="page active" id="page-room">
      <div className="booking-shell" style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>

        {/* Room header */}
        <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.82)),url(\'/assets/images/roomie-real-3.webp\') center/cover', padding: '40px 24px', textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '8px' }}>🏭</div>
              <div style={{ fontFamily: '\'Bebas Neue\',sans-serif', fontSize: '2.5rem', color: 'var(--neon)', textShadow: '0 0 30px rgba(200,255,0,.4)', marginBottom: '4px' }}>VIA TERNI</div>
              <div style={{ fontSize: '.8rem', fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--muted)' }}>TORINO · EX NEGOZIO FRONTE STRADA</div>
              <div className="room-badges">
                <div className="trust-pill" style={{ fontSize: '.75rem' }}><span style={{ color: 'var(--neon)' }}>●</span> Scegli orario</div>
                <div className="trust-pill" style={{ fontSize: '.75rem' }}>{config.maxPeople} persone max</div>
                <div className="trust-pill" style={{ fontSize: '.75rem' }}>40 m²</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
            <div className="room-console-strip">
              <span className="console-pill console-ps" style={{ fontSize: '.72rem' }}>PS1-5</span>
              <span className="console-pill console-xbox" style={{ fontSize: '.72rem' }}>XBOX</span>
              <span className="console-pill console-nintendo" style={{ fontSize: '.72rem' }}>SNES</span>
              <span className="console-pill console-pc" style={{ fontSize: '.72rem' }}>PC 4K</span>
              <span className="logo-pill logo-netflix" style={{ fontSize: '.72rem', padding: '4px 10px' }}>NETFLIX</span>
              <span className="logo-pill logo-dazn" style={{ fontSize: '.72rem', padding: '4px 10px' }}>DAZN</span>
            </div>
          </div>
        </div>

        {/* Booking form */}
        <div className="booking-panel">
          <div className="booking-header">
            <div>
              <div style={{ fontFamily: '\'Bebas Neue\',sans-serif', fontSize: '1.5rem', color: '#fff' }}>PRENOTA LA ROOM</div>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Scegli il mood. Le chips fanno il resto.</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: '\'Barlow Condensed\',sans-serif', fontWeight: 900, fontSize: '2rem', color: 'var(--neon)', lineHeight: '1' }}>
                {totalChips} chips
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>= €{totalChips}</div>
            </div>
          </div>

          <div className="booking-body">
            {/* Progress dots */}
            <div className="booking-progress" aria-label="Step prenotazione">
              {[0, 1, 2, 3].map(i => (
                <button
                  key={i}
                  className={`booking-dot${step === i ? ' active' : ''}`}
                  type="button"
                  onClick={() => setStep(i)}
                />
              ))}
            </div>

            {/* STEP 0: Sessione */}
            {step === 0 && (
              <div className="booking-step active">
                <div className="booking-step-title">Scegli la sessione</div>
                <div className="booking-step-sub">Parti da un preset sociale. Puoi sempre personalizzare dopo.</div>
                <div className="preset-list">
                  {PRESETS.map(p => (
                    <button
                      key={p.id}
                      className={`preset-chip${preset.id === p.id ? ' active' : ''}`}
                      onClick={() => selectPreset(p)}
                    >
                      <span className="preset-copy">
                        <span className="preset-title"><i className={`fas ${p.icon}`}></i> {p.label}</span>
                        <span className="preset-sub">{p.sub}</span>
                      </span>
                      <span className="preset-price">{p.chips} chips</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 1: Data/ora */}
            {step === 1 && (
              <div className="booking-step active">
                <div className="booking-step-title">Quando venite?</div>
                <div className="booking-step-sub">Adesso per entrare subito, oppure pianifica la serata.</div>
                <div className="booking-mode">
                  <button className={mode === 'now' ? 'active' : ''} onClick={() => { setMode('now'); setDate(todayDate()) }}>Adesso</button>
                  <button className={mode === 'plan' ? 'active' : ''} onClick={() => setMode('plan')}>Pianifica</button>
                </div>
                <div className="event-chip">
                  <div className="event-row">
                    <div>
                      <label className="form-label">DATA</label>
                      <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">INIZIO</label>
                      <input type="time" className="form-input" value={start} step="900" onChange={e => setStart(e.target.value)} />
                    </div>
                  </div>
                  <div className="slot-availability">
                    <strong>Orario selezionato</strong>
                    <span>{date} · {start}→{end}</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Persone */}
            {step === 2 && (
              <div className="booking-step active">
                <div className="booking-step-title">Chi viene?</div>
                <div className="booking-step-sub">Tu sei l&apos;host. Aggiungi guest pass per chi entra senza app.</div>
                <div className="event-chip">
                  <label className="form-label">PARTECIPANTI</label>
                  <div className="friend-row">
                    <button className="friend-chip active" type="button" data-fixed="true">
                      <span className="friend-avatar">TU</span>
                      <span className="friend-main">
                        <span className="friend-name">Tu</span>
                        <span className="friend-meta">Host · paghi ora</span>
                      </span>
                      <span className="friend-state">Sempre</span>
                    </button>
                  </div>
                  <div className="guest-stepper">
                    <div>
                      <div className="form-label" style={{ margin: '0 0 3px' }}>GUEST PASS TEMPORANEI</div>
                      <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>+{config.guestPassPrice} chips cad.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button className="guest-btn" type="button" onClick={() => adjustGuests(-1)}>−</button>
                      <div className="guest-count">{guests}</div>
                      <button className="guest-btn" type="button" onClick={() => adjustGuests(1)}>+</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Riepilogo */}
            {step === 3 && (
              <div className="booking-step active">
                <div className="booking-step-title">Extra e riepilogo</div>
                <div className="booking-step-sub">Live Mode, durata custom e totale prima del pagamento.</div>

                <div
                  className={`live-mode-card${liveMode ? ' active' : ''}`}
                  onClick={() => setLiveMode(m => !m)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="live-mode-top">
                    <div>
                      <div className="live-mode-kicker">ROOMIE LIVE MODE</div>
                      <div className="live-mode-title">
                        {liveMode ? `50% cashback dopo live · +${cashback} chips` : 'Paghi normale · 50% torna in chips'}
                      </div>
                    </div>
                    <div className="live-toggle" aria-hidden="true">
                      <span style={{ background: liveMode ? 'var(--neon)' : undefined }}></span>
                    </div>
                  </div>
                  <div className="live-mode-sub">Non è gratis: paghi la sessione ora, poi ricevi cashback in chips se la live è valida.</div>
                </div>

                <div className="booking-option-card">
                  <div className="booking-option-head">
                    <div>
                      <div className="booking-option-title">Durata sessione</div>
                      <div className="booking-option-copy">Il totale si aggiorna subito.</div>
                    </div>
                    <div className="booking-option-tag">Custom</div>
                  </div>
                  <div className="dur-pills">
                    {[1, 2, 3, 4, 5, 6].map(h => (
                      <div
                        key={h}
                        className={`dur-pill${duration === h && !preset.isDay ? ' active' : ''}`}
                        onClick={() => setDur(h)}
                      >{h}h</div>
                    ))}
                  </div>
                </div>

                <div className="price-box">
                  <div className="price-row"><span>Room</span><span>{preset.label} · {preset.isDay ? 'Giornata' : `${duration}h`}</span></div>
                  {guests > 0 && (
                    <div className="price-row"><span>Guest pass ({guests})</span><span>{guestChips} chips</span></div>
                  )}
                  <div className="price-row"><span>Deposito</span><span>0 chips</span></div>
                  {liveMode && (
                    <div className="price-row" style={{ color: 'var(--neon)' }}>
                      <span>Cashback dopo live</span><span>+{cashback} chips</span>
                    </div>
                  )}
                  <div className="price-total">
                    <span>TOTALE</span>
                    <span className="tok">{totalChips} chips</span>
                  </div>
                </div>

                <p style={{ textAlign: 'center', fontSize: '.78rem', color: 'var(--muted)', marginTop: '10px' }}>
                  Saldo attuale: <strong style={{ color: 'var(--neon)' }}>{balance} chips</strong>
                  {balance < totalChips && (
                    <> · <button onClick={() => showPage('token')} style={{ background: 'none', border: 'none', color: 'var(--neon)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>Ricarica</button></>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sticky nav */}
        <div className="booking-sticky">
          <button className="sticky-back" type="button" onClick={goPrev} aria-label="Indietro">
            <i className="fas fa-chevron-left"></i>
          </button>
          <div>
            <div className="sticky-total-label">Step {step + 1} di 4 · {stepLabels[step]}</div>
            <div className="sticky-total-val">{totalChips} chips</div>
            <div style={{ fontSize: '.72rem', color: 'var(--muted)', lineHeight: '1.1' }}>
              {preset.label} · {preset.isDay ? 'Giornata' : `${duration}h`}
            </div>
          </div>
          {step < 3 ? (
            <button className="sticky-next" type="button" onClick={goNext}>CONTINUA</button>
          ) : (
            <button className="sticky-next" type="button" onClick={handleConfirm} disabled={busy}>
              {busy ? '...' : 'PAGA'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
