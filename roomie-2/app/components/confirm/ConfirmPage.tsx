'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '@/app/context/AppContext'
import { bookingStartDate, isBookingLiveNow } from '@/lib/utils'
import type { Booking } from '@/lib/types'
import { apiLogAccess } from '@/lib/client-api'

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

  // Usa sempre il booking reale dall'activeSession quando disponibile.
  const b = activeSession?.booking ?? booking
  const bookingForAccess: Booking | null = activeSession?.booking ?? (b ? ({
    ...b,
    id: (b as any).id || '',
    userId: (b as any).userId || '',
    people: (b as any).people || (b as any).guests || 1,
    status: (b as any).status || 'confirmed',
    createdAt: (b as any).createdAt || new Date().toISOString(),
  } as Booking) : null)
  const lockboxCode = String((activeSession?.booking as any)?.lockboxCode || (b as any)?.lockboxCode || '')
  const bookingId = activeSession?.booking?.id || (b as any)?.id as string | undefined
  const accessLive = bookingForAccess ? isBookingLiveNow(bookingForAccess) : false
  const startsAt = bookingForAccess ? bookingStartDate(bookingForAccess) : null
  const accessDateLabel = startsAt
    ? startsAt.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'orario prenotato'

  // Programmatic scroll to step
  const scrollToStep = useCallback((step: number) => {
    const el = flowRef.current
    if (!el) return
    const stepEl = el.children[step] as HTMLElement | undefined
    if (stepEl) {
      el.scrollTo({ left: stepEl.offsetLeft, behavior: 'smooth' })
    }
    setAccessStep(step)
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
    void apiLogAccess(bookingId, 'lockbox_viewed', 'lockbox')
    scrollToStep(1)
  }

  const handleShutterDone = () => {
    if (!accessLive) return
    setShutterDone(true)
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
    scrollToStep(0)
    setAccessSheetOpen(true)
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
                  <span style={{ fontFamily: '\'Barlow Condensed\',sans-serif', fontSize: '2.5rem', fontWeight: 900, letterSpacing: '8px', color: 'var(--neon)' }}>
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
                <div className="access-desc">Usa la ROOMIE Chip NFC sul lettore oppure il codice porta.</div>
              </div>
            </div>
            <div style={{ height: '160px', borderRadius: '16px', background: 'radial-gradient(circle at 50% 18%,rgba(200,255,0,.18),transparent 52%),linear-gradient(135deg,#050505,#1f1f1f)', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', flexShrink: 0 }}>
              <div className="roomie-chip roomie-chip-lg" aria-label="ROOMIE NFC chip"></div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleDoorUnlock('nfc')}
                style={{ flex: 1, background: 'rgba(0,255,209,.12)', border: '1px solid var(--neon2)', color: 'var(--neon2)', borderRadius: '8px', padding: '12px', fontWeight: 800, fontSize: '.84rem' }}
              >CHIP NFC</button>
              <button
                onClick={() => handleDoorUnlock('code')}
                style={{ flex: 1, background: 'var(--dark3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '12px', fontWeight: 800, fontSize: '.84rem' }}
              >CODICE PORTA</button>
            </div>
          </div>

          {/* Step 4: Dentro */}
          <div className="access-sheet-step">
            <div className="inside-live-chip">
              <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--neon)', marginBottom: '8px' }}>
                <i className="fas fa-unlock"></i> ACCESSO RIUSCITO
              </div>
              <div style={{ fontFamily: '\'Barlow Condensed\',sans-serif', fontWeight: 900, fontSize: '2.4rem', color: '#fff', lineHeight: '1' }}>SEI DENTRO.</div>
              <div style={{ fontSize: '.88rem', color: 'rgba(255,255,255,.72)', marginTop: '8px', lineHeight: '1.55' }}>
                Room tua fino alle <strong style={{ color: 'var(--neon)' }}>{b?.end || '22:00'}</strong>.
              </div>
              <div className="inside-actions" style={{ marginTop: '20px' }}>
                <button className="btn-neon" style={{ justifyContent: 'center', padding: '12px' }} onClick={() => { closeAccessSheet(); showPage('session') }}>
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
      <div className="booking-shell" style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>

        {/* Confirmed hero */}
        <div className="confirm-hero">
          <span className="confirm-emoji"><i className="fas fa-check-circle"></i></span>
          <div className="confirm-title">PRENOTAZIONE<br />CONFERMATA</div>
          <div style={{ fontSize: '.88rem', color: 'rgba(255,255,255,.6)', lineHeight: '1.6' }}>
            La room è bloccata. Prima alzi la serranda, poi apri la porta con ROOMIE Chip o codice.
          </div>
        </div>

        {/* Details */}
        <div className="detail-grid mb-20">
          <div className="detail-item"><div className="detail-label">Data</div><div className="detail-val">{b?.date || '—'}</div></div>
          <div className="detail-item"><div className="detail-label">Orario</div><div className="detail-val">{b?.start || '—'} → {b?.end || '—'}</div></div>
          <div className="detail-item"><div className="detail-label">Persone</div><div className="detail-val">{(b as any)?.people || 1}</div></div>
          <div className="detail-item"><div className="detail-label">Pagato</div><div className="detail-val" style={{ color: 'var(--neon)' }}>{b?.totalChips || 0} chips</div></div>
        </div>

        {/* Arrival card */}
        <div className="arrival-card">
          <div className="arrival-card-top">
            <div>
              <div className="arrival-kicker"><i className="fas fa-location-arrow"></i> ARRIVAL MODE</div>
              <div className="arrival-title">{accessLive ? 'Quando sei davanti, parti da qui.' : 'Accesso non ancora disponibile.'}</div>
              <div className="arrival-copy">
                {accessLive
                  ? 'Codici e ROOMIE Chip sono validi nella fascia della tua prenotazione.'
                  : `La procedura si sblocca da ${accessDateLabel}. Prima di quell'orario chip, codici e step restano disattivati.`}
              </div>
            </div>
            <div className="arrival-now">{accessLive ? 'LIVE' : 'LOCKED'}</div>
          </div>
          <button
            id="arrival-start-btn"
            className="btn-neon w-full"
            style={{ justifyContent: 'center', padding: '13px', marginTop: '14px' }}
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
              <button className="btn-neon" type="button" onClick={() => showPage('dashboard')}>
                <i className="fas fa-user"></i> PROFILO
              </button>
              <button className="quiet-action" type="button" onClick={() => showPage('room')}>
                <i className="fas fa-calendar-check"></i> CAMBIA SLOT
              </button>
            </div>
          </div>
        )}

        <button onClick={() => showPage('shop')} style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '10px', padding: '12px', fontWeight: 700, fontSize: '.85rem', marginTop: '20px', marginBottom: '8px' }}>
          SHOP ADDON & SNACK
        </button>
        <button onClick={() => showPage('dashboard')} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--muted)', borderRadius: '10px', padding: '8px', fontSize: '.82rem' }}>
          Le mie prenotazioni
        </button>
      </div>

      {accessSheet}
    </div>
  )
}
