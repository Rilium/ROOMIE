'use client'

import { useApp } from '@/app/context/AppContext'
import { ShineBorder } from '@/app/components/magicui/shine-border'
import { apiExtendBooking, apiRoomWifi } from '@/lib/client-api'
import { bookingStartDate, isBookingLiveNow } from '@/lib/utils'
import { useEffect, useState } from 'react'

export default function SessionPage() {
  const { activeSession, invitedFriends, removeInvitedFriend, openModalInvite, showPage, showToast, setActiveSession } = useApp()
  const [wifi, setWifi] = useState<{ ssid: string; password: string; configured: boolean } | null>(null)
  const [camEnabled, setCamEnabled] = useState(true)
  const [camExpanded, setCamExpanded] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('—')
  const [minutesLeft, setMinutesLeft] = useState<number>(99)

  const booking = activeSession?.booking
  const sessionFriends = activeSession?.friends?.length ? activeSession.friends : invitedFriends
  const isLive = booking ? isBookingLiveNow(booking) : false
  const liveMode = Boolean(booking?.liveMode)
  const cashback = Math.max(0, Math.round(Number(booking?.totalChips || 24) / 2))
  const startLabel = booking
    ? bookingStartDate(booking).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

  const accessDone = Boolean(activeSession?.doorDone)
  const accessPartial = !accessDone && (Boolean(activeSession?.shutterDone) || Boolean(activeSession?.keyDone))
  const accessIncomplete = isLive && !accessDone && !accessPartial

  // Single access label — one source of truth
  const accessLabel = accessDone ? 'Accesso OK' : activeSession?.shutterDone ? 'Serranda ↑' : activeSession?.keyDone ? 'Chiave ✓' : 'Non avviato'
  const accessIcon = accessDone ? 'fa-check-circle' : accessPartial ? 'fa-circle-half-stroke' : 'fa-exclamation-circle'

  const isUrgent = isLive && minutesLeft < 15
  const isVeryUrgent = isLive && minutesLeft < 5

  // Live countdown
  useEffect(() => {
    const compute = () => {
      if (!booking?.end) { setTimeLeft('—'); setMinutesLeft(99); return }
      const now = new Date()
      const today = now.toISOString().slice(0, 10)
      const endMs = new Date(`${today}T${booking.end}`).getTime()
      const diff = endMs - now.getTime()
      if (diff <= 0) { setTimeLeft('00:00'); setMinutesLeft(0); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setMinutesLeft(h * 60 + m)
      setTimeLeft(
        h > 0
          ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      )
    }
    compute()
    const id = setInterval(compute, 1000)
    return () => clearInterval(id)
  }, [booking?.end])

  // Session progress (0–1) for sticky bar
  const sessionProgress = (() => {
    if (!booking?.start || !booking?.end) return 0
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const startMs = new Date(`${today}T${booking.start}`).getTime()
    const endMs = new Date(`${today}T${booking.end}`).getTime()
    if (endMs <= startMs) return 0
    return Math.min(1, Math.max(0, (now.getTime() - startMs) / (endMs - startMs)))
  })()

  // CTA priority: access > livemode > invite
  const primaryAction = accessIncomplete ? 'access' : isLive && !liveMode ? 'livemode' : isLive && sessionFriends.length === 0 ? 'invite' : 'none'

  const handleExtend = async () => {
    if (!booking?.id) return
    if (!isLive) {
      showToast({ title: 'Sessione non ancora live', copy: `Puoi estendere da ${startLabel}.`, type: 'warn' })
      return
    }
    const { data, error } = await apiExtendBooking(booking.id)
    if (error) { showToast({ title: error, type: 'warn' }); return }
    if (data?.booking && activeSession) setActiveSession({ ...activeSession, booking: data.booking })
    showToast({ title: '+1h aggiunta!' })
  }

  useEffect(() => {
    apiRoomWifi().then(({ data }) => { if (data?.wifi) setWifi(data.wifi) })
  }, [])


  const copyWifi = () => {
    if (!isLive) { showToast({ title: 'Wi-Fi disponibile in sessione', copy: `Torna da ${startLabel}.`, type: 'warn' }); return }
    if (!wifi?.configured) { showToast({ title: 'Wi-Fi non configurato', type: 'warn' }); return }
    navigator.clipboard.writeText(`Wi-Fi: ${wifi.ssid}\nPassword: ${wifi.password}`).catch(() => {})
    showToast({ title: 'Password Wi-Fi copiata' })
  }

  return (
    <div className="page active" id="page-session">
      <div className="session-shell roomie-shell">

        {/* PRE-LIVE GATE */}
        {!isLive && (
          <div className="access-wait-card roomie-visible mb-18">
            <div className="access-wait-kicker"><i className="fas fa-lock"></i> SESSIONE NON LIVE</div>
            <div className="access-wait-title">Questa pagina si accende durante lo slot.</div>
            <div className="access-wait-copy">Comandi room, addon live e +1h sono disponibili da <strong>{startLabel}</strong>.</div>
            <div className="access-wait-actions">
              <button className="btn-neon" type="button" onClick={() => showPage('dashboard')}><i className="fas fa-user"></i> PROFILO</button>
              <button className="quiet-action" type="button" onClick={() => showPage('confirm')}><i className="fas fa-clock"></i> DETTAGLI ACCESSO</button>
            </div>
          </div>
        )}

        {/* ① HERO — session summary: timer + stats + access in one block */}
        <div className={`session-hero${isUrgent ? ' is-urgent' : ''}`}>
          {/* Top status bar */}
          <div className="session-hero-topbar">
            <span className="session-hero-live-indicator">
              <span className={`live-dot${isLive ? '' : ''}`}></span>
              {isLive ? 'LIVE' : 'IN ATTESA'}
            </span>
            <span className="session-hero-room-label">Via Terni · 40m²</span>
            <span className="session-hero-end">fine <strong>{booking?.end || '—'}</strong></span>
          </div>

          {/* Data area: timer + meta */}
          <div className="session-hero-data">
            {/* Left: countdown + +1H */}
            <div className="session-hero-timer-col">
              <span className={`session-hero-countdown${isUrgent ? ' is-urgent' : ''}${isVeryUrgent ? ' is-very-urgent' : ''}`}>
                {isLive ? timeLeft : booking?.end || '—'}
              </span>
              <span className="session-hero-timer-label">{isLive ? 'rimaste' : 'allo slot'}</span>
              {isLive && (
                <button className="session-hero-extend" type="button" onClick={handleExtend} disabled={!isLive}>
                  <i className="fas fa-plus"></i> 1H
                </button>
              )}
            </div>

            {/* Right: compact stats */}
            <div className="session-hero-stats">
              <div className="session-hero-stat">
                <strong>{booking?.people || 1}</strong>
                <span>persone</span>
              </div>
              <div className="session-hero-stat">
                <strong>{booking?.totalChips || 0}</strong>
                <span>chips</span>
              </div>
              <button
                className={`session-hero-access-badge${accessDone ? ' is-ok' : accessPartial ? ' is-partial' : ' is-warn'}`}
                type="button"
                onClick={() => showPage('confirm')}
              >
                <i className={`fas ${accessIcon}`}></i>
                <span>{accessLabel}</span>
              </button>
              <button className="session-hero-wifi" type="button" onClick={copyWifi}>
                <i className="fas fa-wifi"></i>
                <span>{isLive ? 'Wi-Fi' : '—'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ② ACCESS ALERT — single source, only when truly incomplete */}
        {accessIncomplete && (
          <div className="session-access-alert">
            <span className="session-access-alert-icon"><i className="fas fa-triangle-exclamation"></i></span>
            <div className="session-access-alert-copy">
              <strong>Accesso non avviato</strong>
              <span>Completa la procedura per entrare</span>
            </div>
            <button className="session-access-alert-btn" type="button" onClick={() => showPage('confirm')}>
              COMPLETA →
            </button>
          </div>
        )}

        {/* ③ LIVE MODE — GUADAGNA reward headline */}
        <div className={`live-status-card${isLive && liveMode ? ' on' : ''}`} id="session-live-card">
          <div className="session-live-head">
            <div className="session-live-head-left">
              <div className={`roomie-kicker-live ${liveMode ? 'is-live' : 'is-warn'}`}>
                <span className="live-dot"></span>ROOMIE LIVE MODE
              </div>
              <div className="session-live-reward">
                GUADAGNA <span className="session-live-reward-chips">+{cashback} CHIPS</span>
              </div>
            </div>
            <div className="live-consent-col">
              <div className={`live-consent-dot ${isLive ? 'ok' : 'pending'}`} title="Host">H</div>
              <div className={`live-consent-dot ${liveMode ? 'ok' : 'pending'}`} title="Consensi">C</div>
              <div className={`live-consent-dot ${isLive && liveMode ? 'ok' : 'pending'}`} title="Overlay">O</div>
            </div>
          </div>
          <button
            className={`w-full roomie-btn-live-action${primaryAction === 'livemode' ? ' btn-neon' : ' btn-secondary-neon'}`}
            disabled={!isLive}
            onClick={() => showToast({ title: isLive ? 'Live Mode pronta' : 'Sessione non ancora live', copy: isLive ? 'Guadagni chips dopo review. Camera e overlay attivi.' : `Torna da ${startLabel}.` })}
          >
            {isLive ? `AVVIA LIVE MODE` : 'LIVE BLOCCATA FINO ALLO SLOT'}
          </button>
        </div>

        {/* ④ INVITE FRIEND */}
        {sessionFriends.length > 0 && (
          <section className="session-friends-card">
            <div className="session-friends-head">
              <div>
                <div className="in-room-kicker">GRUPPO IN ROOM</div>
                <div className="session-friends-title">{sessionFriends.length + 1} presenti</div>
              </div>
              <span>Tutti dentro?</span>
            </div>
            <div className="session-friends-list">
              <div className="session-friend-pill is-host"><strong>TU</strong><span>Host · presente</span></div>
              {sessionFriends.map(friend => (
                <button className="session-friend-pill" type="button" key={friend.id} onClick={() => removeInvitedFriend(friend.id)}>
                  <strong>{friend.name}</strong>
                  <span>{friend.meta || `@${friend.username}`} · attesa</span>
                </button>
              ))}
            </div>
            {isLive && (
              <button className="quiet-action w-full session-friends-add" type="button" onClick={openModalInvite}>
                <i className="fas fa-user-plus"></i> AGGIUNGI AMICO IN CORSA
              </button>
            )}
            <div className="presence-alert">Esperienze e Live Mode si attivano col gruppo completo.</div>
          </section>
        )}
        {sessionFriends.length === 0 && isLive && (
          <section className="session-friends-card session-friends-solo">
            <div className="session-friends-solo-text">
              <div className="in-room-kicker">GRUPPO IN ROOM</div>
              <div className="session-friends-title">Sei solo</div>
              <div className="session-friends-invite-copy">Invita qualcuno e condividi la sessione</div>
            </div>
            <button
              className={`w-full roomie-btn-session-action${primaryAction === 'invite' ? ' btn-neon' : ' quiet-action'}`}
              type="button"
              onClick={openModalInvite}
            >
              <i className="fas fa-user-plus"></i> AGGIUNGI AMICO IN CORSA
            </button>
          </section>
        )}

        {/* ⑤ ROOM CAM — bar with split actions */}
        <div className="session-cam-wrap">
          <div className="session-cam-bar">
            <div className="session-cam-bar-left">
              <span className={`live-dot${isLive && camEnabled ? ' is-active' : ''}`}></span>
              <span className="session-cam-bar-label">
                {!camEnabled ? 'CAM SPENTA' : isLive ? 'ROOM CAM ATTIVA' : 'CAM BLOCCATA'}
              </span>
            </div>
            <div className="session-cam-bar-actions">
              <button
                className="session-cam-action"
                type="button"
                onClick={() => setCamExpanded(e => !e)}
              >
                {camExpanded ? 'Chiudi' : 'Apri'}
              </button>
              <button
                className={`session-cam-action${camEnabled ? ' is-deactivate' : ' is-activate'}`}
                type="button"
                onClick={() => setCamEnabled(e => !e)}
              >
                {camEnabled ? 'Disattiva' : 'Riattiva'}
              </button>
            </div>
          </div>

          {camExpanded && (
            <div className={`camera-card session-camera${isLive && camEnabled ? '' : ' is-locked'}${camEnabled ? '' : ' is-off'}`} aria-label="Telecamera live ROOMIE">
              <div className="camera-feed"></div>
              <div className="camera-overlay">
                <div>
                  <div className="camera-top">
                    <div className="camera-live">{!camEnabled ? 'OFF' : isLive ? 'LIVE' : 'LOCKED'}</div>
                    <div className="camera-roomie">ROOMIE CAM</div>
                  </div>
                  <div className="camera-meta">
                    <span className="camera-pill">Via Terni · 40 m2</span>
                    <span className="camera-pill">{new Date().toLocaleDateString('it-IT')}</span>
                    <span className="camera-pill">{!camEnabled ? 'cam disattivata' : isLive ? 'ON AIR' : 'slot non live'}</span>
                  </div>
                </div>
                <div>
                  <div className="camera-title">{!camEnabled ? 'ROOMIE CAM SPENTA.' : isLive ? 'LIVE ROOMIE ATTIVA.' : 'CAMERA BLOCCATA.'}</div>
                  <div className="camera-chips">
                    <span className="camera-chip"><i className="fas fa-check"></i> Overlay</span>
                    <span className="camera-chip"><i className="fas fa-check"></i> Privacy</span>
                    <span className="camera-chip"><i className="fas fa-check"></i> Stop visibile</span>
                  </div>
                </div>
              </div>
              {(!isLive || !camEnabled) && (
                <div className="camera-lock-overlay">
                  <div className="camera-lock-panel">
                    <div className="camera-lock-kicker">{camEnabled ? 'Accesso richiesto' : 'Cam off'}</div>
                    <div className="camera-lock-title">{camEnabled ? 'Si sblocca quando sei dentro.' : 'Riprendi solo se vuoi.'}</div>
                    <div className="camera-lock-copy">{camEnabled ? 'Live cam si attiva nella fascia pagata.' : 'La room resta attiva, feed e Live Mode spenti.'}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ⑥ ROOM CONTROL — 2x2 grid: Pack | Aiuto | WiFi | Dettagli */}
        <div className="in-room-panel">
          <div className="in-room-head in-room-head-compact">
            <div className="in-room-kicker">ROOM CONTROL</div>
            <div className="room-status-pill"><i className={`fas ${isLive ? 'fa-bolt' : 'fa-lock'}`}></i> {isLive ? 'LIVE' : 'LOCKED'}</div>
          </div>
          <div className="quick-controls quick-controls-2col">
            <button className="quick-control" disabled={!isLive} onClick={() => showPage('shop')}>
              <i className="fas fa-layer-group"></i>Pack<span>snack, mood</span>
            </button>
            <button className="quick-control" onClick={() => showToast({ title: 'Assistenza avvisata', copy: 'Il team riceve sessione, orario e stato accesso.' })}>
              <i className="fas fa-headset"></i>Aiuto<span>priorità live</span>
            </button>
            <button className="quick-control" disabled={!isLive} onClick={copyWifi}>
              <i className="fas fa-wifi"></i>Wi-Fi<span>{wifi?.configured ? 'copia password' : 'disponibile'}</span>
            </button>
            <button className="quick-control" onClick={() => showPage('confirm')}>
              <i className="fas fa-receipt"></i>Dettagli<span>prenotazione</span>
            </button>
          </div>
        </div>

        {/* ⑦ CONTROL ROOM — Urgente full + Chip/Snack 2-col */}
        <section className="control-room-card">
          <ShineBorder size={112} duration={7.4} initialOffset={66} colorFrom="#C8FF00" colorTo="#00FFD1" borderWidth={1.2} />
          <div className="control-room-head control-room-head-compact">
            <div className="in-room-kicker">CONTROL ROOM</div>
            <span className={`control-room-state${isLive ? ' is-live' : ''}`}>{isLive ? 'LIVE' : 'LOCKED'}</span>
          </div>
          <div className="control-room-grid">
            <button className="control-room-action is-urgent is-wide" type="button" onClick={() => showToast({ title: 'Assistenza avvisata', copy: 'Il team riceve sessione, orario e stato accesso.' })}>
              <span className="control-room-icon"><i className="fas fa-headset"></i></span>
              <span className="control-room-copy">
                <strong>Problema accesso o room</strong>
                <small>Priorità durante la sessione</small>
              </span>
              <span className="control-room-meta">URGENTE</span>
            </button>
            <button className="control-room-action" type="button" onClick={() => showToast({ title: 'ROOMIE Chip pronta', copy: 'Avvicina la fiche fisica al lettore sulla porta.' })}>
              <span className="control-room-icon"><i className="fas fa-microchip"></i></span>
              <span className="control-room-copy">
                <strong>Chip fisica</strong>
                <small>Chip o codice porta</small>
              </span>
              <span className="control-room-meta"><i className="fas fa-chevron-right"></i></span>
            </button>
            <button className="control-room-action" type="button" onClick={() => showPage('shop')}>
              <span className="control-room-icon"><i className="fas fa-shopping-bag"></i></span>
              <span className="control-room-copy">
                <strong>Snack & setup</strong>
                <small>Addon e mood</small>
              </span>
              <span className="control-room-meta"><i className="fas fa-chevron-right"></i></span>
            </button>
          </div>
        </section>

      </div>

      <div className="session-sticky">
        <ShineBorder size={112} duration={6.2} initialOffset={34} colorFrom="#00FFD1" colorTo="#FF3DCE" borderWidth={1.4} />
        <div
          className="session-progress-bar"
          style={{ '--session-progress': `${Math.round(sessionProgress * 100)}%` } as React.CSSProperties}
        />
        <div className="session-sticky-info">
          <span className={`session-sticky-status${isLive ? ' is-live' : ''}`}>
            <span className="live-dot"></span>{isLive ? 'LIVE' : 'IN ATTESA'}
          </span>
          <span className={`session-sticky-end${isUrgent ? ' is-urgent' : ''}`}>
            {isUrgent ? `⚠ ${timeLeft}` : `fine `}{isUrgent ? '' : <strong>{booking?.end || '—'}</strong>}
          </span>
        </div>
        <div className="session-sticky-actions">
          <button className="session-extend-btn session-extend-primary" disabled={!isLive} onClick={handleExtend}>
            <i className="fas fa-clock"></i> +1H
          </button>
          <button className="btn-secondary-neon roomie-btn-center" disabled={!isLive} onClick={() => showPage('shop')}>
            <i className="fas fa-layer-group"></i> AGGIUNTE
          </button>
        </div>
      </div>
    </div>
  )
}
