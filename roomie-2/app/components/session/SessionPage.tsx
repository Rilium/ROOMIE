'use client'

import { useApp } from '@/app/context/AppContext'
import { apiExtendBooking } from '@/lib/client-api'
import { bookingStartDate, isBookingLiveNow } from '@/lib/utils'

export default function SessionPage() {
  const { activeSession, showPage, showToast, setActiveSession } = useApp()
  const booking = activeSession?.booking
  const isLive = booking ? isBookingLiveNow(booking) : false
  const liveMode = Boolean((booking as any)?.liveMode)
  const cashback = Math.max(0, Math.round(Number(booking?.totalChips || 24) / 2))
  const startLabel = booking
    ? bookingStartDate(booking).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

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

  return (
    <div className="page active" id="page-session">
      <div className="session-shell" style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
        {!isLive && (
          <div className="access-wait-card" style={{ display: 'block', marginBottom: '18px' }}>
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

        <div className="session-hero">
          <div className="session-hero-content">
            <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--neon)', marginBottom: '8px' }}>
              <i className={`fas ${isLive ? 'fa-unlock' : 'fa-lock'}`}></i> {isLive ? 'ACCESSO RIUSCITO' : 'IN ATTESA SLOT'}
            </div>
            <div style={{ fontFamily: '\'Barlow Condensed\',sans-serif', fontWeight: 900, fontSize: '2.6rem', color: '#fff', lineHeight: '1' }}>{isLive ? 'SEI DENTRO.' : 'NON ANCORA.'}</div>
            <div style={{ fontSize: '.9rem', color: 'rgba(255,255,255,.74)', marginTop: '8px' }}>
              Room tua fino alle <strong style={{ color: 'var(--neon)' }}>{booking?.end || '22:00'}</strong>
            </div>
          </div>
        </div>

        <div className="session-grid">
          <div className="session-tile"><strong className="session-timer">{booking?.end || '—'}</strong><span>{isLive ? 'fine sessione' : 'si attiva allo start'}</span></div>
          <div className="session-tile"><strong>{booking?.people || 1} persona{(booking?.people || 1) !== 1 ? 'e' : ''}</strong><span>split attivo · {booking?.totalChips || 0} chips</span></div>
          <div className="session-tile"><strong>Sicurezza OK</strong><span>serranda alzata · chiave riposta · porta OK</span></div>
          <div className="session-tile"><strong>Wi-Fi Roomie</strong><span>tocca per copiare la password</span></div>
        </div>

        <div className={`camera-card session-camera${isLive ? '' : ' is-locked'}`} aria-label="Roomie live camera mock">
          <div className="camera-feed"></div>
          <div className="camera-overlay">
            <div>
              <div className="camera-top">
                <div className="camera-live">{isLive ? 'LIVE' : 'LOCKED'}</div>
                <div className="camera-roomie">ROOMIE CAM</div>
              </div>
              <div className="camera-meta">
                <span className="camera-pill">Via Terni · 40 m2</span>
                <span className="camera-pill">{new Date().toLocaleDateString('it-IT')}</span>
                <span className="camera-pill">{isLive ? 'ON AIR' : 'slot non live'}</span>
              </div>
            </div>
            <div>
              <div className="camera-title">{isLive ? 'LIVE ROOMIE ATTIVA.' : 'CAMERA BLOCCATA FINO ALLO SLOT.'}</div>
              <div className="camera-ticker">
                <span>ROOMIE LIVE · overlay pronto · stop sempre visibile · privacy check attivo · </span>
              </div>
            </div>
          </div>
          {!isLive && (
            <div className="camera-lock-overlay">
              <div className="camera-lock-panel">
                <div className="camera-lock-kicker">Accesso richiesto</div>
                <div className="camera-lock-title">Si sblocca quando sei dentro.</div>
                <div className="camera-lock-copy">Live cam, shop e comandi room si attivano nella fascia pagata.</div>
              </div>
            </div>
          )}
        </div>

        <div className="in-room-panel">
          <div className="in-room-head">
            <div>
              <div className="in-room-kicker">ROOM CONTROL</div>
              <div className="in-room-title">La room è tua adesso.</div>
              <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.64)', lineHeight: '1.45', marginTop: '6px' }}>Azioni veloci durante la sessione.</div>
            </div>
            <div className="room-status-pill"><i className={`fas ${isLive ? 'fa-bolt' : 'fa-lock'}`}></i> {isLive ? 'POWER ON' : 'LOCKED'}</div>
          </div>
          <div className="quick-controls">
            <button className="quick-control" disabled={!isLive} onClick={() => showPage('shop')}>
              <i className="fas fa-layer-group"></i>Pack<span>partita, snack, mood</span>
            </button>
            <button className="quick-control" disabled={!isLive} onClick={handleExtend}>
              <i className="fas fa-clock"></i>+1h<span>estendi al volo</span>
            </button>
            <button className="quick-control" onClick={() => showToast({ title: 'Assistenza avvisata', copy: 'Il team riceve sessione, orario e stato accesso.' })}>
              <i className="fas fa-headset"></i>Aiuto<span>priorità sessione live</span>
            </button>
          </div>
        </div>

        <div className={`live-status-card${isLive && liveMode ? ' on' : ''}`} id="session-live-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', color: liveMode ? 'var(--neon)' : 'var(--orange)', marginBottom: '8px' }}>
                <span className="live-dot"></span>ROOMIE LIVE MODE
              </div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: '1.9rem', color: '#fff', lineHeight: 1 }}>
                {liveMode ? 'Vai live, recuperi 50%' : 'Live Mode disponibile'}
              </div>
              <div style={{ fontSize: '.84rem', color: 'rgba(255,255,255,.68)', lineHeight: 1.5, marginTop: '8px' }}>
                Cashback in chips dopo review. Camera dedicata, overlay Roomie, stop sempre visibile.
              </div>
            </div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: '1.8rem', color: 'var(--neon)', whiteSpace: 'nowrap' }}>+{cashback}</div>
          </div>
          <div className="live-consent-row">
            <div className={`live-consent ${isLive ? 'ok' : 'pending'}`}>Host</div>
            <div className={`live-consent ${liveMode ? 'ok' : 'pending'}`}>Consensi</div>
            <div className={`live-consent ${isLive && liveMode ? 'ok' : 'pending'}`}>Overlay</div>
          </div>
          <button
            className="btn-neon w-full"
            disabled={!isLive}
            style={{ justifyContent: 'center', padding: '13px', marginTop: '14px' }}
            onClick={() => showToast({ title: isLive ? 'Live Mode pronta' : 'Sessione non ancora live', copy: isLive ? 'Mock camera pronto. Domani colleghiamo il feed reale.' : `Torna da ${startLabel}.` })}
          >
            {isLive ? 'AVVIA LIVE MODE' : 'LIVE BLOCCATA FINO ALLO SLOT'}
          </button>
        </div>

        <div className="chip mt-20" style={{ padding: '18px' }}>
          <div style={{ fontWeight: 900, color: '#fff', marginBottom: '8px' }}>Control room</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="drawer-link" onClick={() => showToast({ title: 'ROOMIE Chip pronta', copy: 'Avvicina la fiche fisica al lettore sulla porta.' })}>
              <span><i className="fas fa-microchip"></i> ROOMIE Chip fisica</span>
              <span><i className="fas fa-chevron-right"></i></span>
            </button>
            <button className="drawer-link" onClick={() => showPage('shop')}>
              <span><i className="fas fa-shopping-bag"></i> Snack, streaming e setup</span>
              <span><i className="fas fa-chevron-right"></i></span>
            </button>
            <button className="drawer-link" onClick={() => showToast({ title: 'Assistenza avvisata · risposta in chat' })}>
              <span>Problema accesso o room</span>
              <span>URGENTE</span>
            </button>
            <button className="drawer-link" onClick={() => {
              navigator.clipboard.writeText('Wi-Fi: $wag_Barca\nPassword: !nexus2018.').catch(() => {})
              showToast({ title: 'Password Wi-Fi copiata' })
            }}>
              <span>Wi-Fi Roomie</span>
              <span>COPIA</span>
            </button>
            <button className="drawer-link" onClick={() => showPage('dashboard')}>
              <span><i className="fas fa-receipt"></i> Dettagli prenotazione</span>
              <span><i className="fas fa-chevron-right"></i></span>
            </button>
          </div>
        </div>
      </div>

      <div className="session-sticky">
        <button className="btn-neon" disabled={!isLive} style={{ justifyContent: 'center' }} onClick={() => showPage('shop')}>ADDON</button>
        <button disabled={!isLive} style={{ background: 'var(--dark3)', border: '1px solid rgba(200,255,0,.35)', color: 'var(--neon)' }} onClick={handleExtend}>+1H</button>
      </div>
    </div>
  )
}
