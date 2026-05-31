'use client'

import { useState, useCallback } from 'react'
import { useApp } from '@/app/context/AppContext'

export default function ConfirmPage() {
  const { booking, activeSession, setActiveSession, showPage, showToast, config } = useApp()
  const [accessStep, setAccessStep] = useState(0)
  const [codeVisible, setCodeVisible] = useState(false)
  const [keyDone, setKeyDone] = useState(false)
  const [shutterDone, setShutterDone] = useState(false)

  const b = activeSession?.booking || booking

  const copyCode = useCallback(() => {
    const code = config.lockboxCode || '4729'
    navigator.clipboard.writeText(code).catch(() => {})
    showToast({ title: 'Codice copiato' })
  }, [config.lockboxCode, showToast])

  const handleKeyDone = () => {
    setKeyDone(true)
    setAccessStep(1)
  }

  const handleShutterDone = () => {
    setShutterDone(true)
    setAccessStep(2)
  }

  const handleDoorUnlock = () => {
    setAccessStep(3)
    if (activeSession) {
      setActiveSession({ ...activeSession, doorDone: true, shutterDone: true, keyDone: true })
    }
  }

  return (
    <div className="page active" id="page-confirm">
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>

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
              <div className="arrival-title">Quando sei davanti, parti da qui.</div>
              <div className="arrival-copy">Codici e ROOMIE Chip sono validi nella fascia della tua prenotazione.</div>
            </div>
            <div className="arrival-now">READY</div>
          </div>
          <button
            className="btn-neon w-full"
            style={{ justifyContent: 'center', padding: '13px', marginTop: '14px' }}
            onClick={() => setAccessStep(0)}
          >
            <i className="fas fa-route"></i> INIZIA ACCESSO
          </button>
        </div>

        {/* Access flow */}
        <div className="access-flow" id="access-flow" style={{ marginTop: '20px' }}>

          {/* Step 1: Cassaforte */}
          {accessStep === 0 && (
            <div className="access-step active" id="step-lockbox">
              <div className="access-head">
                <div className="access-num">1</div>
                <div>
                  <div className="access-title">Apri la cassaforte della serranda</div>
                  <div className="access-desc">La trovi sulla finestra a sinistra della porta. Dentro c&apos;è la chiave della serranda.</div>
                </div>
              </div>
              <div className="access-display">
                <div className={`access-code-text${codeVisible ? '' : ' masked'}`} id="key-code" data-code={config.lockboxCode}>
                  {codeVisible ? (
                    <span style={{ fontFamily: '\'Barlow Condensed\',sans-serif', fontSize: '2.5rem', fontWeight: 900, letterSpacing: '8px', color: 'var(--neon)' }}>
                      {config.lockboxCode || '4729'}
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
                  onPointerDown={() => setCodeVisible(true)}
                  onPointerUp={() => setCodeVisible(false)}
                  onPointerLeave={() => setCodeVisible(false)}
                  onTouchStart={() => setCodeVisible(true)}
                  onTouchEnd={() => setCodeVisible(false)}
                >
                  <i className="fas fa-eye"></i> Mostra codice
                </button>
              </div>
              <div className="access-primary-copy">Dopo aver aperto la cassaforte, prendi la chiave della serranda.</div>
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={handleKeyDone}
                  style={{ width: '100%', background: 'var(--neon)', border: 'none', color: 'var(--dark)', borderRadius: '8px', padding: '12px', fontWeight: 900, fontSize: '.82rem' }}
                >
                  HO PRESO LA CHIAVE
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Serranda */}
          {accessStep === 1 && (
            <div className="access-step active" id="step2-panel">
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
                className="btn-neon w-full"
                style={{ justifyContent: 'center', padding: '14px' }}
                onClick={handleShutterDone}
              >VAI ALLA PORTA</button>
            </div>
          )}

          {/* Step 3: Porta */}
          {accessStep === 2 && (
            <div className="access-step active" id="door-panel">
              <div className="access-head">
                <div className="access-num">3</div>
                <div>
                  <div className="access-title">Apri la porta</div>
                  <div className="access-desc">Usa la ROOMIE Chip NFC sul lettore oppure il codice porta.</div>
                </div>
              </div>
              <div style={{ height: '170px', borderRadius: '16px', background: 'radial-gradient(circle at 50% 18%,rgba(200,255,0,.18),transparent 52%),linear-gradient(135deg,#050505,#1f1f1f)', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <div className="roomie-chip roomie-chip-lg" aria-label="ROOMIE NFC chip"></div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleDoorUnlock}
                  style={{ flex: 1, background: 'rgba(0,255,209,.12)', border: '1px solid var(--neon2)', color: 'var(--neon2)', borderRadius: '8px', padding: '12px', fontWeight: 800, fontSize: '.84rem' }}
                >CHIP NFC</button>
                <button
                  onClick={handleDoorUnlock}
                  style={{ flex: 1, background: 'var(--dark3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '12px', fontWeight: 800, fontSize: '.84rem' }}
                >CODICE PORTA</button>
              </div>
            </div>
          )}

          {/* Step 4: Dentro */}
          {accessStep === 3 && (
            <div className="access-step active" id="step3-panel">
              <div className="inside-live-chip">
                <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--neon)', marginBottom: '8px' }}>
                  <i className="fas fa-unlock"></i> ACCESSO RIUSCITO
                </div>
                <div style={{ fontFamily: '\'Barlow Condensed\',sans-serif', fontWeight: 900, fontSize: '2.4rem', color: '#fff', lineHeight: '1' }}>SEI DENTRO.</div>
                <div style={{ fontSize: '.88rem', color: 'rgba(255,255,255,.72)', marginTop: '8px', lineHeight: '1.55' }}>
                  Room tua fino alle <strong style={{ color: 'var(--neon)' }}>{b?.end || '22:00'}</strong>.
                </div>
                <div className="inside-actions">
                  <button className="btn-neon" style={{ justifyContent: 'center', padding: '12px' }} onClick={() => showPage('session')}>
                    SESSIONE LIVE
                  </button>
                  <button className="btn-neon" onClick={() => showPage('shop')}>ADDON</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav arrows */}
        <div className="access-nav">
          <button className="access-arrow" type="button" onClick={() => setAccessStep(s => Math.max(0, s - 1))} aria-label="Step precedente">
            <i className="fas fa-chevron-left"></i>
          </button>
          <div className="access-nav-label">
            Step accesso <strong>{['Cassaforte', 'Serranda', 'Porta', 'Dentro'][accessStep]}</strong>
          </div>
          <button className="access-arrow" type="button" onClick={() => setAccessStep(s => Math.min(3, s + 1))} aria-label="Step successivo">
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>

        <button onClick={() => showPage('shop')} style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '10px', padding: '12px', fontWeight: 700, fontSize: '.85rem', marginTop: '20px', marginBottom: '8px' }}>
          SHOP ADDON & SNACK
        </button>
        <button onClick={() => showPage('dashboard')} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--muted)', borderRadius: '10px', padding: '8px', fontSize: '.82rem' }}>
          Le mie prenotazioni
        </button>
      </div>
    </div>
  )
}
