'use client'

import { useApp } from '@/app/context/AppContext'
import { ShineBorder } from '@/app/components/magicui/shine-border'
import { DiaTextReveal } from '@/app/components/magicui/dia-text-reveal'
import { apiExtendBooking, apiRoomWifi } from '@/lib/client-api'
import { bookingStartDate, isBookingLiveNow } from '@/lib/utils'
import { useEffect, useState } from 'react'

export default function SessionPage() {
  const { activeSession, invitedFriends, removeInvitedFriend, openModalInvite, showPage, showToast, setActiveSession } = useApp()
  const [wifi, setWifi] = useState<{ ssid: string; password: string; configured: boolean } | null>(null)
  const [camEnabled, setCamEnabled] = useState(true)
  const booking = activeSession?.booking
  const sessionFriends = activeSession?.friends?.length ? activeSession.friends : invitedFriends
  const isLive = booking ? isBookingLiveNow(booking) : false
  const liveMode = Boolean(booking?.liveMode)
  const cashback = Math.max(0, Math.round(Number(booking?.totalChips || 24) / 2))
  const startLabel = booking
    ? bookingStartDate(booking).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

  const accessIncomplete = isLive && !activeSession?.doorDone && !activeSession?.shutterDone && !activeSession?.keyDone

  const sessionProgress = (() => {
    if (!booking?.start || !booking?.end) return 0
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const startMs = new Date(`${today}T${booking.start}`).getTime()
    const endMs = new Date(`${today}T${booking.end}`).getTime()
    if (endMs <= startMs) return 0
    return Math.min(1, Math.max(0, (now.getTime() - startMs) / (endMs - startMs)))
  })()

  const handleExtend = async () => {
    if (!booking?.id) return
    if (!isLive) {
      showToast({ title: 'Sessione non ancora live', copy: `Puoi estendere da ${startLabel}.`, type: 'warn' })
      return
    }
    const { data, error } = await apiExtendBooking(booking.id)
    if (error) { showToast({ title: error, type: 'warn' }); return }
    if (data?.booking && activeSession) {
      setActiveSession({ ...activeSession, booking: data.booking })
    }
    showToast({ title: '+1h aggiunta!' })
  }

  useEffect(() => {
    apiRoomWifi().then(({ data }) => {
      if (data?.wifi) setWifi(data.wifi)
    })
  }, [])

  const copyWifi = () => {
    if (!isLive) {
      showToast({ title: 'Wi-Fi disponibile in sessione', copy: `Torna da ${startLabel}.`, type: 'warn' })
      return
    }
    if (!wifi?.configured) {
      showToast({ title: 'Wi-Fi non configurato', type: 'warn' })
      return
    }
    navigator.clipboard.writeText(`Wi-Fi: ${wifi.ssid}\nPassword: ${wifi.password}`).catch(() => {})
    showToast({ title: 'Password Wi-Fi copiata' })
  }

  return (
    <div className="page active" id="page-session">
      <div className="session-shell roomie-shell">
        {!isLive && (
          <div className="access-wait-card roomie-visible mb-18">
            <div className="access-wait-kicker"><i className="fas fa-lock"></i> SESSIONE NON LIVE</div>
            <div className="access-wait-title">Questa pagina si accende durante lo slot.</div>
            <div className="access-wait-copy">Comandi room, addon live e +1h sono disponibili da <strong>{startLabel}</strong>.</div>
            <div className="access-wait-actions">
              <button className="btn-neon" type="button" onClick={() => showPage('dashboard')}>
                <i className="fas fa-user"></i> PROFILO
              </button>
              <button className="quiet-action" type="button" onClick={() => showPage('confirm')}>
                <i className="fas fa-clock"></i> DETTAGLI ACCESSO
              </button>
            </div>
          </div>
        )}

        {/* ① HERO — compact, countdown merged into subtitle */}
        <div className="session-hero">
          <div className="session-hero-content">
            <div className="roomie-kicker-neon">
              <i className={`fas ${isLive ? 'fa-unlock' : 'fa-lock'}`}></i> {isLive ? 'ACCESSO RIUSCITO' : 'IN ATTESA SLOT'}
            </div>
            <DiaTextReveal className="roomie-title-condensed roomie-title-session">
              {isLive ? 'SEI DENTRO.' : 'NON ANCORA.'}
            </DiaTextReveal>
            <div className="roomie-copy-session">
              Room tua fino alle <strong className="roomie-strong-neon">{booking?.end || '22:00'}</strong>
            </div>
          </div>
        </div>

        {/* ② STAT GRID — 2×2 */}
        <div className="session-grid">
          <div className="session-tile"><strong className="session-timer">{booking?.end || '—'}</strong><span>{isLive ? 'fine sessione' : 'si attiva allo start'}</span></div>
          <div className="session-tile"><strong>{booking?.people || 1} persona{(booking?.people || 1) !== 1 ? 'e' : ''}</strong><span>split attivo · {booking?.totalChips || 0} chips</span></div>
          <div className="session-tile">
            <strong>
              {activeSession?.doorDone ? 'Accesso OK' : activeSession?.shutterDone ? 'Serranda aperta' : activeSession?.keyDone ? 'Chiave presa' : 'Accesso non avviato'}
            </strong>
            <span>
              {activeSession?.doorDone ? 'serranda alzata · chiave riposta · porta OK' : activeSession?.shutterDone ? 'chiave riposta · vai alla porta' : activeSession?.keyDone ? 'serranda in attesa' : 'completa la procedura di accesso'}
            </span>
          </div>
          <button className="session-tile roomie-tile-button" type="button" onClick={copyWifi}>
            <strong>Wi-Fi Roomie</strong>
            <span>{isLive ? 'tocca per copiare' : 'disponibile in sessione'}</span>
          </button>
        </div>

        {/* ③ ACCESS ALERT BANNER — only when access is incomplete during live */}
        {accessIncomplete && (
          <div className="session-access-alert">
            <span className="session-access-alert-icon"><i className="fas fa-triangle-exclamation"></i></span>
            <div className="session-access-alert-copy">
              <strong>Accesso non avviato</strong>
              <span>Completa la procedura per entrare nella room</span>
            </div>
            <button className="session-access-alert-btn" type="button" onClick={() => showPage('confirm')}>
              COMPLETA →
            </button>
          </div>
        )}

        {/* ④ LIVE MODE — revenue-first, above camera */}
        <div className={`live-status-card${isLive && liveMode ? ' on' : ''}`} id="session-live-card">
          <div className="session-live-head">
            <div>
              <div className={`roomie-kicker-live ${liveMode ? 'is-live' : 'is-warn'}`}>
                <span className="live-dot"></span>ROOMIE LIVE MODE
              </div>
              <div className="roomie-title-condensed roomie-title-card">
                {liveMode ? 'Vai live, recuperi 50%' : 'Live Mode disponibile'}
              </div>
              <div className="live-mode-copy">
                Guadagni chips guardando la tua sessione. Camera dedicata, overlay e stop sempre visibile.
              </div>
            </div>
            <div className="roomie-value-neon">+{cashback}</div>
          </div>
          <div className="live-consent-row">
            <div className={`live-consent ${isLive ? 'ok' : 'pending'}`}>Host</div>
            <div className={`live-consent ${liveMode ? 'ok' : 'pending'}`}>Consensi</div>
            <div className={`live-consent ${isLive && liveMode ? 'ok' : 'pending'}`}>Overlay</div>
          </div>
          <button
            className="btn-neon w-full roomie-btn-live-action"
            disabled={!isLive}
            onClick={() => showToast({ title: isLive ? 'Live Mode pronta' : 'Sessione non ancora live', copy: isLive ? 'Mock camera pronto. Domani colleghiamo il feed reale.' : `Torna da ${startLabel}.` })}
          >
            {isLive ? `AVVIA LIVE MODE · +${cashback} chips` : 'LIVE BLOCCATA FINO ALLO SLOT'}
          </button>
        </div>

        {/* ⑤ INVITE FRIEND — social before camera */}
        {sessionFriends.length > 0 && (
          <section className="session-friends-card">
            <div className="session-friends-head">
              <div>
                <div className="in-room-kicker">GRUPPO IN ROOM</div>
                <div className="session-friends-title">{sessionFriends.length + 1} persone previste</div>
              </div>
              <span>Tutti presenti?</span>
            </div>
            <div className="session-friends-list">
              <div className="session-friend-pill is-host"><strong>TU</strong><span>Host · presente</span></div>
              {sessionFriends.map(friend => (
                <button className="session-friend-pill" type="button" key={friend.id} onClick={() => removeInvitedFriend(friend.id)}>
                  <strong>{friend.name}</strong>
                  <span>{friend.meta || `@${friend.username}`} · attesa check-in</span>
                </button>
              ))}
            </div>
            {isLive && (
              <button className="quiet-action w-full session-friends-add" type="button" onClick={openModalInvite}>
                <i className="fas fa-user-plus"></i> AGGIUNGI AMICO IN CORSA
              </button>
            )}
            <div className="presence-alert">
              Se manca qualcuno puoi entrare, ma esperienze, luci e Live Mode restano in standby finche&apos; il gruppo non e&apos; completo.
            </div>
          </section>
        )}
        {sessionFriends.length === 0 && isLive && (
          <section className="session-friends-card">
            <div className="session-friends-head">
              <div>
                <div className="in-room-kicker">GRUPPO IN ROOM</div>
                <div className="session-friends-title">Sei solo — invita qualcuno</div>
              </div>
            </div>
            <button className="btn-neon w-full roomie-btn-session-action" type="button" onClick={openModalInvite}>
              <i className="fas fa-user-plus"></i> AGGIUNGI AMICO IN CORSA
            </button>
          </section>
        )}

        {/* ⑥ CAMERA — below fold, collapsible */}
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
              <div className="camera-title">{!camEnabled ? 'ROOMIE CAM SPENTA.' : isLive ? 'LIVE ROOMIE ATTIVA.' : 'CAMERA BLOCCATA FINO ALLO SLOT.'}</div>
              <div className="camera-chips">
                <span className="camera-chip"><i className="fas fa-check"></i> Overlay</span>
                <span className="camera-chip"><i className="fas fa-check"></i> Privacy</span>
                <span className="camera-chip"><i className="fas fa-check"></i> Stop visibile</span>
              </div>
              <button
                type="button"
                className={`camera-toggle${camEnabled ? ' active' : ''}`}
                onClick={() => setCamEnabled(enabled => !enabled)}
                aria-pressed={camEnabled}
              >
                {camEnabled ? 'DISATTIVA CAM' : 'RIATTIVA CAM'}
              </button>
            </div>
          </div>
          {(!isLive || !camEnabled) && (
            <div className="camera-lock-overlay">
              <div className="camera-lock-panel">
                <div className="camera-lock-kicker">{camEnabled ? 'Accesso richiesto' : 'Cam off'}</div>
                <div className="camera-lock-title">{camEnabled ? 'Si sblocca quando sei dentro.' : 'Riprendi solo se vuoi.'}</div>
                <div className="camera-lock-copy">{camEnabled ? 'Live cam, shop e comandi room si attivano nella fascia pagata.' : 'La room resta attiva, ma il feed mock e il Live Mode sono spenti.'}</div>
                {!camEnabled && (
                  <button className="camera-lock-btn" type="button" onClick={() => setCamEnabled(true)}>
                    <i className="fas fa-video"></i> RIATTIVA CAM
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ⑦ ROOM CONTROLS — 2-col grid, no +1h duplicate */}
        <div className="in-room-panel">
          <div className="in-room-head">
            <div>
              <div className="in-room-kicker">ROOM CONTROL</div>
              <div className="in-room-title">La room è tua.</div>
              <div className="roomie-copy-soft">Azioni veloci durante la sessione.</div>
            </div>
            <div className="room-status-pill"><i className={`fas ${isLive ? 'fa-bolt' : 'fa-lock'}`}></i> {isLive ? 'LIVE' : 'LOCKED'}</div>
          </div>
          <div className="quick-controls quick-controls-2col">
            <button className="quick-control" disabled={!isLive} onClick={() => showPage('shop')}>
              <i className="fas fa-layer-group"></i>Pack<span>partita, snack, mood</span>
            </button>
            <button className="quick-control" onClick={() => showToast({ title: 'Assistenza avvisata', copy: 'Il team riceve sessione, orario e stato accesso.' })}>
              <i className="fas fa-headset"></i>Aiuto<span>priorità sessione live</span>
            </button>
          </div>
        </div>

        {/* ⑧ CONTROL ROOM — urgente first, booking as text link */}
        <section className="control-room-card">
          <ShineBorder size={112} duration={7.4} initialOffset={66} colorFrom="#C8FF00" colorTo="#00FFD1" borderWidth={1.2} />
          <div className="control-room-head">
            <div>
              <div className="in-room-kicker">CONTROL ROOM</div>
              <div className="control-room-title">Comandi sessione</div>
            </div>
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
                <strong>ROOMIE Chip fisica</strong>
                <small>Apri con chip o codice porta</small>
              </span>
              <span className="control-room-meta"><i className="fas fa-chevron-right"></i></span>
            </button>
            <button className="control-room-action" type="button" onClick={() => showPage('shop')}>
              <span className="control-room-icon"><i className="fas fa-shopping-bag"></i></span>
              <span className="control-room-copy">
                <strong>Snack, streaming e setup</strong>
                <small>Addon e mood della room</small>
              </span>
              <span className="control-room-meta"><i className="fas fa-chevron-right"></i></span>
            </button>
            <button className="control-room-action is-wide" type="button" onClick={copyWifi}>
              <span className="control-room-icon"><i className="fas fa-wifi"></i></span>
              <span className="control-room-copy">
                <strong>Wi-Fi Roomie</strong>
                <small>{wifi?.configured ? wifi.ssid : 'Rete disponibile in room'}</small>
              </span>
              <span className="control-room-meta">{isLive ? 'COPIA' : 'LOCKED'}</span>
            </button>
          </div>
          <button className="control-room-booking-link" type="button" onClick={() => showPage('confirm')}>
            <i className="fas fa-receipt"></i>
            Vedi prenotazione · {booking ? `${booking.date} · ${booking.start}–${booking.end}` : 'riepilogo accesso'}
            <i className="fas fa-chevron-right"></i>
          </button>
        </section>
      </div>

      {/* ⑨ STICKY BAR — progress bar, no duplicate timer, AGGIUNTE */}
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
          <span className="session-sticky-end">fine <strong>{booking?.end || '—'}</strong></span>
        </div>
        <div className="session-sticky-actions">
          <button className="btn-neon roomie-btn-center" disabled={!isLive} onClick={() => showPage('shop')}><i className="fas fa-layer-group"></i> AGGIUNTE</button>
          <button className="session-extend-btn" disabled={!isLive} onClick={handleExtend}><i className="fas fa-clock"></i> +1H</button>
        </div>
      </div>
    </div>
  )
}
