'use client'

import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

function spawnConfetti() {
  const colors = ['#C8FF00', '#00FFD1', '#FF5A1F', '#fff', '#FFD700', '#FF3DCE']
  for (let i = 0; i < 72; i++) {
    const el = document.createElement('div')
    el.className = 'confetti-piece'
    el.style.cssText = `left:${Math.random() * 100}vw;top:${-8 - Math.random() * 24}px;background:${colors[i % colors.length]};transform:rotate(${Math.random() * 360}deg) scaleX(${0.4 + Math.random() * 0.6});animation-delay:${(Math.random() * 0.7).toFixed(2)}s;animation-duration:${(1 + Math.random() * 0.7).toFixed(2)}s`
    document.body.appendChild(el)
    el.addEventListener('animationend', () => el.remove(), { once: true })
  }
}
import { useApp } from '@/app/context/AppContext'
import { apiCreateBooking, apiBookingPrice, invalidateDashboardCache } from '@/lib/client-api'
import BookingCalendar from './BookingCalendar'
import {
  BookingFlowLayout,
  BookingStepper,
  BookingStickyBar,
  CompactRoomSummary,
  SessionOptionCard,
  type BookingStepItem,
  type RoomExperience,
} from '@/app/components/booking/BookingFlowComponents'

interface Preset {
  id: string
  label: string
  icon: string
  sub: string
  duration: number
  chips: number
  defaultStart: string
  isDay?: boolean
  badge?: string
}

const PRESETS: Preset[] = [
  { id: 'quick', label: 'Quick Match', icon: 'fa-bolt', sub: '1h · da adesso · botta veloce', duration: 1, chips: 12, defaultStart: '18:00' },
  { id: 'ranked', label: 'Ranked Session', icon: 'fa-gamepad', sub: '2h · valore migliore', duration: 2, chips: 24, defaultStart: '20:00', badge: 'CONSIGLIATA' },
  { id: 'movie', label: 'Movie Night', icon: 'fa-film', sub: '3h · ore 20:00 · divano e schermo pieno', duration: 3, chips: 36, defaultStart: '20:00' },
  { id: 'full', label: 'Full Experience', icon: 'fa-trophy', sub: '09:00-23:00 · tutto tuo', duration: 14, chips: 60, defaultStart: '09:00', isDay: true },
]

const BOOKING_STEPS: BookingStepItem[] = [
  { label: 'Sessione' },
  { label: 'Orario' },
  { label: 'Extra' },
  { label: 'Checkout' },
]

const ROOM_EXPERIENCES: RoomExperience[] = [
  { label: 'PS5', className: 'console-pill console-ps' },
  { label: 'XBOX', className: 'console-pill console-xbox' },
  { label: 'SNES', className: 'console-pill console-nintendo' },
  { label: 'PC 4K', className: 'console-pill console-pc' },
  { label: 'NETFLIX', className: 'logo-pill logo-netflix' },
  { label: 'DAZN', className: 'logo-pill logo-dazn' },
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

function nowDateTime(): { date: string; time: string } {
  const d = new Date()
  d.setSeconds(0, 0)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return { date, time }
}

export default function BookingPage() {
  const { user, config, invitedFriends, removeInvitedFriend, setUser, setBookingDraft, setActiveSession, openModalInvite, showPage, showToast, activePage } = useApp()
  const [mounted, setMounted] = useState(false)

  const [step, setStep] = useState(0)
  const [preset, setPresetState] = useState<Preset>(PRESETS[1])
  const [duration, setDuration] = useState(2)
  const [date, setDate] = useState(todayDate())
  const [start, setStart] = useState('20:00')
  const [guests, setGuests] = useState(0)
  const [liveMode, setLiveMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'now' | 'plan'>('plan')
  const [slotConflict, setSlotConflict] = useState<string | null>(null)
  // serverPrice: fetched from /api/bookings/price; falls back to local estimate
  const [serverPrice, setServerPrice] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  const end = addHours(start, duration)
  // Local estimate (shown while server confirms)
  const baseChips = preset.isDay ? config.dayPrice : duration * config.hourlyPrice
  const guestChips = guests * config.guestPassPrice
  const totalPeople = 1 + invitedFriends.length + guests
  const totalChips = serverPrice ?? (baseChips + guestChips)
  const cashback = Math.floor(totalChips * 0.5)
  const balance = user?.chips ?? 0

  // Fetch server-side price whenever booking params change
  useEffect(() => {
    let cancelled = false
    setPriceLoading(true)
    setServerPrice(null)
    apiBookingPrice(preset.id, duration, guests).then(({ data }) => {
      if (!cancelled && data?.totalChips != null) setServerPrice(data.totalChips)
    }).finally(() => {
      if (!cancelled) setPriceLoading(false)
    })
    return () => { cancelled = true }
  }, [preset.id, duration, guests])

  // Reset step when page changes to room
  useEffect(() => {
    if (activePage === 'room') setStep(0)
  }, [activePage])

  useEffect(() => {
    setGuests(prev => Math.min(prev, Math.max(0, config.maxPeople - 1 - invitedFriends.length)))
  }, [config.maxPeople, invitedFriends.length])

  // Sync draft to context whenever booking changes
  useEffect(() => {
    setBookingDraft({
      preset: preset.id,
      duration,
      date,
      start,
      end,
      guests,
      friends: invitedFriends.map(friend => friend.id),
      liveMode,
      totalChips,
      totalEur: totalChips,
      room: 'Via Terni',
      step,
    })
  }, [preset, duration, date, start, guests, invitedFriends, liveMode, totalChips, step, setBookingDraft, end])

  const selectPreset = useCallback((p: Preset) => {
    setPresetState(p)
    setDuration(p.duration)
    setStart(p.defaultStart)
    setSlotConflict(null)
  }, [])

  const setDur = useCallback((h: number) => {
    setDuration(h)
    setPresetState(prev => ({ ...prev, isDay: false }))
    setSlotConflict(null)
  }, [])

  const adjustGuests = useCallback((delta: number) => {
    setGuests(prev => Math.max(0, Math.min(config.maxPeople - 1 - invitedFriends.length, prev + delta)))
  }, [config.maxPeople, invitedFriends.length])

  const goNext = useCallback(() => {
    if (step === 3) return
    if (step === 1) setSlotConflict(null)
    setStep(s => s + 1)
  }, [step])

  const goPrev = useCallback(() => {
    if (step === 0) { showPage('home'); return }
    setStep(s => s - 1)
  }, [step, showPage])

  const handleConfirm = useCallback(async () => {
    if (priceLoading) {
      showToast({ title: 'Prezzo in verifica', copy: 'Aspetta un secondo: stiamo confermando il totale server.', type: 'warn' })
      return
    }
    if (balance < totalChips) {
      showToast({ title: 'Saldo insufficiente', copy: 'Ricarica chips prima di procedere.', type: 'warn' })
      showPage('token')
      return
    }
    if (totalPeople > config.maxPeople) {
      showToast({ title: 'Troppi partecipanti', copy: `Massimo ${config.maxPeople}: rimuovi qualcuno o abbassa i guest pass.`, type: 'warn' })
      setStep(2)
      return
    }
    setBusy(true)
    const { data, error } = await apiCreateBooking({
      date,
      start,
      end,
      people: totalPeople,
      friendIds: invitedFriends.map(friend => friend.id),
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
        SLOT_BLOCKED: 'Questo slot e gia occupato o bloccato. Torna allo step orario e scegli un altro inizio.',
        BAD_BOOKING_DATE: 'Data non valida.',
        BAD_BOOKING_TIME: 'Orario non valido.',
        BAD_PEOPLE: `Troppi partecipanti (max ${config.maxPeople}).`,
      }
      if (error === 'SLOT_BLOCKED') {
        setSlotConflict(`${date} · ${start}-${end}`)
        setStep(1)
      }
      showToast({ title: error === 'SLOT_BLOCKED' ? 'Slot non disponibile' : (msgs[error || ''] || 'Errore prenotazione.'), copy: error === 'SLOT_BLOCKED' ? msgs.SLOT_BLOCKED : undefined, type: 'warn' })
      return
    }
    // Update context with server-confirmed booking + updated user chips
    if (data.user) setUser(data.user)
    setBookingDraft(data.booking)
    // Inizializza la sessione attiva con la prenotazione appena creata
    setActiveSession({
      booking: data.booking,
      friends: invitedFriends,
      accessStep: 0,
      shutterDone: false,
      keyDone: false,
      doorDone: false,
    })
    spawnConfetti()
    invalidateDashboardCache()
    showToast({ title: 'Prenotazione confermata!' })
    showPage('confirm')
  }, [priceLoading, balance, totalChips, totalPeople, invitedFriends, preset, duration, date, start, end, guests, liveMode, config.maxPeople, setUser, setBookingDraft, setActiveSession, showPage, showToast])

  const handleNowMode = useCallback(() => {
    const current = nowDateTime()
    setMode('now')
    setDate(current.date)
    setStart(current.time)
    setSlotConflict(null)
  }, [])

  const selectedDurationLabel = preset.isDay ? '09:00-23:00' : `${duration}h`
  const selectedItemLabel = `${preset.label} · ${selectedDurationLabel}`
  const stickyPrice = priceLoading
    ? <span className="inline-skeleton-price" aria-label="Prezzo in caricamento"></span>
    : `${totalChips} chips`
  const formatChipPrice = useCallback((chips: number) => `${chips} chips`, [])

  const stickyNav = (
    <BookingStickyBar
      currentStep={step + 1}
      totalSteps={BOOKING_STEPS.length}
      price={stickyPrice}
      selectedItem={selectedItemLabel}
      ctaLabel={step < 3 ? 'CONTINUA' : (busy ? '...' : 'PAGA')}
      onBack={goPrev}
      onCta={step < 3 ? goNext : handleConfirm}
      disabled={step === 3 && (busy || priceLoading || serverPrice == null)}
    />
  )

  return (
    <div className="page active" id="page-room">
      {mounted ? createPortal(stickyNav, document.body) : stickyNav}
      <div className="booking-shell roomie-shell roomie-shell-compact">
        <BookingFlowLayout
          roomSummary={
            <CompactRoomSummary
              title="VIA TERNI"
              location="Torino · Ex negozio fronte strada"
              image="/assets/images/roomie-real-3.webp"
              status="Disponibile"
              stats={[
                { label: 'Capienza', value: `${config.maxPeople} persone` },
                { label: 'Superficie', value: '40 m²' },
              ]}
              experiences={ROOM_EXPERIENCES}
            />
          }
        >
          <div className="booking-panel">

          <div className="booking-body">
            <BookingStepper steps={BOOKING_STEPS} activeStep={step} onStepClick={setStep} />

            {/* STEP 0: Sessione */}
            {step === 0 && (
              <div className="booking-step active">
                <div className="booking-step-title">Scegli la sessione</div>
                <div className="booking-step-sub">Configura la durata di partenza. Premendo Continua passi alla scelta dell&apos;orario.</div>
                <div className="preset-list">
                  {PRESETS.map(p => (
                    <SessionOptionCard
                      key={p.id}
                      option={p}
                      selected={preset.id === p.id}
                      onSelect={selectPreset}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* STEP 1: Data/ora — BookingCalendar */}
            {step === 1 && (
              <div className="booking-step active">
                <div className="booking-step-title">Quando venite?</div>
                <div className="booking-step-sub">Adesso per entrare subito, oppure pianifica la serata.</div>
                <BookingCalendar
                  date={date}
                  start={start}
                  end={end}
                  duration={duration}
                  mode={mode}
                  onDateChange={d => { setDate(d); setSlotConflict(null) }}
                  onStartChange={t => { setStart(t); setSlotConflict(null) }}
                  onModeChange={m => {
                    if (m === 'now') { handleNowMode() }
                    else { setMode('plan'); setSlotConflict(null) }
                  }}
                />
                {slotConflict && (
                  <div className="slot-availability blocked" role="alert" style={{ marginTop: 12 }}>
                    <strong>Slot non disponibile</strong>
                    <span>{slotConflict} è già occupato o bloccato. Scegli un altro orario.</span>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Persone */}
            {step === 2 && (
              <div className="booking-step active">
                <div className="booking-step-title">Extra per il gruppo</div>
                <div className="booking-step-sub">Tu sei l&apos;host. Aggiungi amici Roomie o guest pass temporanei.</div>
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
                    {invitedFriends.map(friend => (
                      <button className="friend-chip active" type="button" key={friend.id} onClick={() => removeInvitedFriend(friend.id)}>
                        <span className="friend-avatar">{friend.name.slice(0, 2).toUpperCase()}</span>
                        <span className="friend-main">
                          <span className="friend-name">{friend.name}</span>
                          <span className="friend-meta">{friend.meta || `@${friend.username}`}</span>
                        </span>
                        <span className="friend-state">Rimuovi</span>
                      </button>
                    ))}
                    <button className="friend-chip add" type="button" onClick={openModalInvite}>
                      <span className="friend-avatar friend-avatar-plus">+</span>
                      <span className="friend-main">
                        <span className="friend-name">Aggiungi amico</span>
                        <span className="friend-meta">Cerca su Roomie o invia link</span>
                      </span>
                    </button>
                  </div>
                  {invitedFriends.length > 0 && (
                    <div className="presence-alert">
                      Tutti i membri del gruppo devono essere presenti per avviare esperienze, luci e Live Mode. Se manca qualcuno entri lo stesso, ma la room resta in modalità attesa.
                    </div>
                  )}
                  <div className="guest-stepper">
                    <div>
                      <div className="form-label guest-pass-label">GUEST PASS TEMPORANEI</div>
                      <div className="booking-guest-note">
                        {totalPeople}/{config.maxPeople} persone · +{formatChipPrice(config.guestPassPrice)} cad.
                      </div>
                    </div>
                    <div className="booking-inline-row">
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
                <div className="booking-step-title">Checkout</div>
                <div className="booking-step-sub">Controlla extra, durata e totale prima del pagamento.</div>

                <button
                  type="button"
                  className={`live-mode-card${liveMode ? ' active' : ''}`}
                  onClick={() => setLiveMode(m => !m)}
                  aria-pressed={liveMode}
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
                </button>

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
                      <button
                        key={h}
                        className={`dur-pill${duration === h && !preset.isDay ? ' active' : ''}`}
                        type="button"
                        onClick={() => setDur(h)}
                        aria-pressed={duration === h && !preset.isDay}
                      >{h}h</button>
                    ))}
                  </div>
                </div>

                <div className="price-box">
                  <div className="price-row"><span>Room</span><span>{preset.label} · {preset.isDay ? 'Giornata' : `${duration}h`}</span></div>
                  {invitedFriends.length > 0 && (
                    <div className="price-row"><span>Account Roomie ({invitedFriends.length})</span><span>inclusi</span></div>
                  )}
                  {guests > 0 && (
                    <div className="price-row"><span>Guest pass ({guests})</span><span>{formatChipPrice(guestChips)}</span></div>
                  )}
                  <div className="price-row"><span>Deposito</span><span>{formatChipPrice(0)}</span></div>
                  {liveMode && (
                    <div className="price-row text-neon">
                      <span>Cashback dopo live</span><span>+{cashback} chips</span>
                    </div>
                  )}
                  <div className="price-total">
                    <span>TOTALE</span>
                    <span className="tok">
                      {priceLoading ? <span className="inline-skeleton-price" aria-label="Prezzo in caricamento"></span> : formatChipPrice(totalChips)}
                    </span>
                  </div>
                  {!priceLoading && <div className="price-euro-note">Equivalente indicativo: €{totalChips}</div>}
                </div>

                <p className="booking-balance-note">
                  Saldo attuale: <strong className="roomie-strong-neon">{balance} chips</strong>
                  {balance < totalChips && (
                    <> · <button onClick={() => showPage('token')} className="booking-link-reset">Ricarica</button></>
                  )}
                </p>
              </div>
            )}
          </div>
          </div>
        </BookingFlowLayout>

      </div>
    </div>
  )
}
