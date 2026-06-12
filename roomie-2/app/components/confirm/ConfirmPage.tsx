'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '@/app/context/AppContext'
import ChipAmount from '@/app/components/ui/ChipAmount'
import RoomieLogoText from '@/app/components/ui/RoomieLogoText'
import { bookingStartDate, isBookingLiveNow } from '@/lib/utils'
import type { Booking } from '@/lib/types'
import { apiLogAccess } from '@/lib/client-api'

type ConfirmBooking = Partial<Booking> & {
  id?: string
  people?: number
}

export default function ConfirmPage() {
  const { booking, activeSession, setActiveSession, showPage, showToast } = useApp()
  const [accessStep, setAccessStep] = useState(0)
  const [accessSheetOpen, setAccessSheetOpen] = useState(false)
  const [codeVisible, setCodeVisible] = useState(false)
  const [keyDone, setKeyDone] = useState(false)
  const [shutterDone, setShutterDone] = useState(false)
  const [mounted, setMounted] = useState(false)
  const flowRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // L'accesso fisico deve usare solo booking reali, mai draft client.
  const b = (activeSession?.booking ?? booking) as ConfirmBooking
  const bookingForAccess: Booking | null = activeSession?.booking ?? null
  const lockboxCode = String(activeSession?.booking?.lockboxCode || b.lockboxCode || '')
  const bookingId = activeSession?.booking?.id || b.id
  const accessLive = bookingForAccess ? isBookingLiveNow(bookingForAccess) : false
  const startsAt = bookingForAccess ? bookingStartDate(bookingForAccess) : null
  const accessDateLabel = startsAt
    ? startsAt.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'orario prenotato'

  // Programmatic scroll to step
  const scrollToStep = useCallback((step: number) => {
    setAccessStep(step)
    const el = flowRef.current
    if (!el) return
    window.requestAnimationFrame(() => {
      const stepEl = el.children[step] as HTMLElement | undefined
      if (stepEl) el.scrollTo({ left: stepEl.offsetLeft, behavior: 'smooth' })
    })
  }, [])

  const copyCode = useCallback(() => {
    if (!accessLive) {
      showToast({ title: 'Accesso non ancora disponibile', copy: `Si sblocca da ${accessDateLabel}.`, type: 'warn' })
      return
    }
    if (!lockboxCode) {
      showToast({ title: 'Codice non disponibile', copy: 'Contatta il supporto Roomie.', type: 'warn' })
      return
    }
    navigator.clipboard.writeText(lockboxCode).catch(() => {})
    void apiLogAccess(bookingId, 'lockbox_copied', 'lockbox')
    showToast({ title: 'Codice copiato' })
  }, [accessDateLabel, accessLive, bookingId, lockboxCode, showToast])

  const handleKeyDone = () => {
    if (!accessLive) {
      showToast({ title: 'Accesso bloccato', copy: `Codici e chip si attivano da ${accessDateLabel}.`, type: 'warn' })
      return
    }
    setKeyDone(true)
    if (activeSession) setActiveSession({ ...activeSession, keyDone: true })
    void apiLogAccess(bookingId, 'lockbox_viewed', 'lockbox')
    scrollToStep(1)
  }

  const handleShutterDone = () => {
    if (!accessLive) {
      showToast({ title: 'Accesso bloccato', copy: `Si sblocca da ${accessDateLabel}.`, type: 'warn' })
      return
    }
    setShutterDone(true)
    if (activeSession) setActiveSession({ ...activeSession, keyDone: true, shutterDone: true })
    void apiLogAccess(bookingId, 'shutter_done', 'key')
    void apiLogAccess(bookingId, 'key_replaced', 'lockbox')
    scrollToStep(2)
  }

  const handleDoorUnlock = (method: 'nfc' | 'code') => {
    if (!accessLive || !keyDone || !shutterDone) {
      showToast({ title: 'Completa prima gli step precedenti', type: 'warn' })
      return
    }
    void apiLogAccess(bookingId, method === 'nfc' ? 'door_nfc' : 'door_code', method)
    void apiLogAccess(bookingId, 'door_opened', method)
    void apiLogAccess(bookingId, 'session_started', method)
    if (activeSession) {
      setActiveSession({ ...activeSession, doorDone: true, shutterDone: true, keyDone: true })
    }
    scrollToStep(3)
  }

  const goAccessPrev = () => {
    const next = Math.max(0, accessStep - 1)
    scrollToStep(next)
  }

  const goAccessNext = () => {
    if (!accessLive) return
    if (accessStep === 0 && !keyDone) {
      showToast({ title: 'Prima prendi la chiave dalla cassaforte', type: 'warn' })
      return
    }
    if (accessStep === 1 && !shutterDone) {
      showToast({ title: 'Prima alza la serranda e riponi la chiave', type: 'warn' })
      return
    }
    if (accessStep === 2) {
      showToast({ title: 'Apri la porta con chip o codice', type: 'warn' })
      return
    }
    scrollToStep(Math.min(3, accessStep + 1))
  }

  const openAccessSheet = () => {
    if (!accessLive) {
      showToast({ title: 'Accesso non ancora disponibile', copy: `Torna da ${accessDateLabel}.`, type: 'warn' })
      return
    }
    setAccessSheetOpen(true)
    window.setTimeout(() => scrollToStep(accessStep), 80)
  }

  const closeAccessSheet = () => setAccessSheetOpen(false)

  // ── Access Sheet (portal) ──────────────────────────────────────────────────
  const accessSheet = mounted ? createPortal(
    <div
      className={`access-sheet-overlay${accessSheetOpen ? ' open' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) closeAccessSheet() }}
      aria-modal="true"
      role="dialog"
      aria-label="Procedura accesso room"
    >
      <div className="access-sheet">
        {/* Handle */}
        <div className="access-sheet-handle" />

        {/* Header */}
        <div className="access-sheet-header">
          <div>
            <div className="access-sheet-kicker"><i className="fas fa-route"></i> ACCESSO ROOM</div>
            <div className="access-sheet-title">
              {['Cassaforte', 'Serranda', 'Porta', 'Dentro'][accessStep]}
            </div>
          </div>
          <button className="access-sheet-close" type="button" onClick={closeAccessSheet} aria-label="Chiudi">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Step dots */}
        <div className="access-sheet-dots">
          {['Cassaforte', 'Serranda', 'Porta', 'Dentro'].map((label, i) => (
            <button
              key={i}
              className={`access-dot${accessStep === i ? ' active' : ''}${i < accessStep ? ' done' : ''}`}
              type="button"
              onClick={() => scrollToStep(i)}
              aria-label={`Step ${i + 1}: ${label}`}
            >
              {i < accessStep ? <i className="fas fa-check" /> : i + 1}
            </button>
          ))}
        </div>

        {/* Scroll-snap flow — all 4 steps rendered simultaneously */}
        <div className="access-sheet-flow" ref={flowRef}>

          {/* Step 1: Cassaforte */}
          <div className="access-sheet-step">
            <div className="access-head">
              <div className="access-num">1</div>
              <div>
                <div className="access-title">Apri la cassaforte della serranda</div>
                <div className="access-desc">La trovi sulla finestra a sinistra della porta. Dentro c&apos;è la chiave della serranda.</div>
              </div>
            </div>
            <div className="access-display">
              <div className={`access-code-text${codeVisible ? '' : ' masked'}`}>
                {codeVisible ? (
                  <span className="confirm-code">
                    {lockboxCode}
                  </span>
                ) : (
                  <>
                    <span className="code-mask-icon"><i className="fas fa-lock"></i></span>
                    <span className="code-mask-icon"><i className="fas fa-lock"></i></span>
                    <span className="code-mask-icon"><i className="fas fa-lock"></i></span>
                    <span className="code-mask-icon"><i className="fas fa-lock"></i></span>
                  </>
                )}
              </div>
              <div className="access-hint">Tieni premuto per vedere · Valido fino alle {b?.end || '22:00'}</div>
            </div>
            <div className="code-action-row">
              <button className="access-secondary-btn" onClick={copyCode}>
                <i className="fas fa-copy"></i> Copia codice
              </button>
              <button
                className="access-hold-btn"
                disabled={!accessLive || !lockboxCode}
                onPointerDown={() => setCodeVisible(true)}
                onPointerUp={() => setCodeVisible(false)}
                onPointerLeave={() => setCodeVisible(false)}
              >
                <i className="fas fa-eye"></i> Mostra codice
              </button>
            </div>
            <div className="access-primary-copy">Dopo aver aperto la cassaforte, prendi la chiave della serranda.</div>
            <button
              className="access-confirm-btn"
              onClick={handleKeyDone}
              disabled={keyDone}
            >
              {keyDone ? <><i className="fas fa-check"></i> CHIAVE PRESA</> : 'HO PRESO LA CHIAVE'}
            </button>
          </div>

          {/* Step 2: Serranda */}
          <div className="access-sheet-step">
            <div className="access-head">
              <div className="access-num">2</div>
              <div>
                <div className="access-title">Alza la serranda con la chiave</div>
                <div className="access-desc">Apri la serranda, poi rimetti subito la chiave nella cassaforte e richiudi il lucchetto.</div>
              </div>
            </div>
            <div className="access-check-card">
              <div className="access-check-title">Prima di andare alla porta</div>
              <div className="access-check-list">
                <span><i className="fas fa-check-circle"></i> Serranda alzata</span>
                <span><i className="fas fa-key"></i> Chiave riposta nella cassaforte</span>
                <span><i className="fas fa-lock"></i> Lucchetto richiuso</span>
              </div>
            </div>
            <button
              className="access-confirm-btn"
              onClick={handleShutterDone}
              disabled={shutterDone}
            >
              {shutterDone ? <><i className="fas fa-check"></i> SERRANDA FATTA</> : 'VAI ALLA PORTA'}
            </button>
          </div>

          {/* Step 3: Porta */}
          <div className="access-sheet-step">
            <div className="access-head">
              <div className="access-num">3</div>
              <div>
                <div className="access-title">Apri la porta</div>
                <div className="access-desc">Usa la <RoomieLogoText size="xs" /> Chip NFC sul lettore oppure il codice porta.</div>
              </div>
            </div>
            <div className="confirm-access-art">
              <div className="roomie-chip roomie-chip-lg" aria-label="ROOMIE NFC chip"></div>
            </div>
            <div className="confirm-access-actions">
              <button
                onClick={() => handleDoorUnlock('nfc')}
                className="confirm-access-primary"
              >CHIP NFC</button>
              <button
                onClick={() => handleDoorUnlock('code')}
                className="confirm-access-secondary"
              >CODICE PORTA</button>
            </div>
          </div>

          {/* Step 4: Dentro */}
          <div className="access-sheet-step">
            <div className="inside-live-chip">
              <div className="roomie-kicker-neon">
                <i className="fas fa-unlock"></i> ACCESSO RIUSCITO
              </div>
              <div className="confirm-access-title">SEI DENTRO.</div>
              <div className="confirm-access-copy">
                Room tua fino alle <strong className="roomie-strong-neon">{b?.end || '22:00'}</strong>.
              </div>
              <div className="inside-actions mt-20">
                <button className="btn-neon btn btn-primary roomie-btn-access-action" onClick={() => { closeAccessSheet(); showPage('session') }}>
                  SESSIONE LIVE
                </button>
                <button className="btn-outline-neon" onClick={() => { closeAccessSheet(); showPage('shop') }}>ADDON</button>
              </div>
            </div>
          </div>
        </div>

        {/* Nav arrows */}
        <div className="access-sheet-nav">
          <button className="access-arrow" type="button" onClick={goAccessPrev} aria-label="Step precedente" disabled={accessStep === 0}>
            <i className="fas fa-chevron-left"></i>
          </button>
          <div className="access-nav-label">
            Step <strong>{['Cassaforte', 'Serranda', 'Porta', 'Dentro'][accessStep]}</strong>
          </div>
          <button className="access-arrow" type="button" onClick={goAccessNext} aria-label="Step successivo" disabled={accessStep === 3}>
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className={`page active${accessLive ? '' : ' access-waiting'}`} id="page-confirm">
      <div className="booking-shell roomie-shell">

        {/* Confirmed hero */}
        <div className="confirm-hero">
          <span className="confirm-emoji"><i className="fas fa-check-circle"></i></span>
          <div className="confirm-title">PRENOTAZIONE<br />CONFERMATA</div>
          <div className="confirm-muted-copy">
            La room è bloccata. Prima alzi la serranda, poi apri la porta con <RoomieLogoText size="xs" /> Chip o codice.
          </div>
        </div>

        {/* Details */}
        <div className="detail-grid mb-20">
          <div className="detail-item"><div className="detail-label">Data</div><div className="detail-val">{b?.date || '—'}</div></div>
          <div className="detail-item"><div className="detail-label">Orario</div><div className="detail-val">{b?.start || '—'} → {b?.end || '—'}</div></div>
          <div className="detail-item"><div className="detail-label">Persone</div><div className="detail-val">{b.people || 1}</div></div>
          <div className="detail-item"><div className="detail-label">Pagato</div><div className="detail-val roomie-strong-neon"><ChipAmount amount={b?.totalChips || 0} size="sm" tone="primary" /></div></div>
        </div>

        {/* Arrival card */}
        <div className="arrival-card">
          <div className="arrival-card-top">
            <div>
              <div className="arrival-kicker"><i className="fas fa-location-arrow"></i> ARRIVAL MODE</div>
              <div className="arrival-title">{accessLive ? 'Quando sei davanti, parti da qui.' : 'Accesso non ancora disponibile.'}</div>
              <div className="arrival-copy">
                {accessLive
                  ? <>Codici e <RoomieLogoText size="xs" /> Chip sono validi nella fascia della tua prenotazione.</>
                  : `La procedura si sblocca da ${accessDateLabel}. Prima di quell'orario chip, codici e step restano disattivati.`}
              </div>
            </div>
            <div className="arrival-now">{accessLive ? 'LIVE' : 'LOCKED'}</div>
          </div>
          <button
            id="arrival-start-btn"
            className="btn-neon btn btn-primary w-full roomie-btn-live-action"
            onClick={openAccessSheet}
          >
            <i className="fas fa-route"></i> INIZIA ACCESSO
          </button>
        </div>

        {!accessLive && (
          <div className="access-wait-card">
            <div className="access-wait-kicker"><i className="fas fa-clock"></i> ACCESSO PROGRAMMATO</div>
            <div className="access-wait-title">Torna quando la sessione è live.</div>
            <div className="access-wait-copy">
              Serranda, cassaforte e porta si attivano solo nella fascia pagata. Prossimo sblocco: <strong>{accessDateLabel}</strong>.
            </div>
            <div className="access-wait-actions">
              <button className="btn-neon btn btn-primary" type="button" onClick={() => showPage('dashboard')}>
                <i className="fas fa-user"></i> PROFILO
              </button>
              <button className="quiet-action btn btn-outline-light" type="button" onClick={() => showPage('room')}>
                <i className="fas fa-calendar-check"></i> CAMBIA SLOT
              </button>
            </div>
          </div>
        )}

        <button onClick={() => showPage('shop')} className="confirm-secondary-btn">
          SHOP ADDON & SNACK
        </button>
        <button onClick={() => showPage('dashboard')} className="confirm-tertiary-btn">
          Le mie prenotazioni
        </button>
      </div>

      {accessSheet}
    </div>
  )
}
