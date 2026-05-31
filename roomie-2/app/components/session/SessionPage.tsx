'use client'

import { useApp } from '@/app/context/AppContext'
import { apiExtendBooking } from '@/lib/client-api'

export default function SessionPage() {
  const { activeSession, showPage, showToast, setActiveSession } = useApp()
  const booking = activeSession?.booking

  const handleExtend = async () => {
    if (!booking?.id) return
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

        <div className="session-hero">
          <div className="session-hero-content">
            <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--neon)', marginBottom: '8px' }}>
              <i className="fas fa-unlock"></i> ACCESSO RIUSCITO
            </div>
            <div style={{ fontFamily: '\'Barlow Condensed\',sans-serif', fontWeight: 900, fontSize: '2.6rem', color: '#fff', lineHeight: '1' }}>SEI DENTRO.</div>
            <div style={{ fontSize: '.9rem', color: 'rgba(255,255,255,.74)', marginTop: '8px' }}>
              Room tua fino alle <strong style={{ color: 'var(--neon)' }}>{booking?.end || '22:00'}</strong>
            </div>
          </div>
        </div>

        <div className="session-grid">
          <div className="session-tile"><strong className="session-timer">{booking?.end || '—'}</strong><span>fine sessione</span></div>
          <div className="session-tile"><strong>{booking?.people || 1} persona{(booking?.people || 1) !== 1 ? 'e' : ''}</strong><span>partecipanti</span></div>
          <div className="session-tile"><strong>Sicurezza OK</strong><span>serranda alzata · chiave riposta</span></div>
          <div className="session-tile"><strong>Wi-Fi Roomie</strong><span>tocca per copiare la password</span></div>
        </div>

        <div className="in-room-panel">
          <div className="in-room-head">
            <div>
              <div className="in-room-kicker">ROOM CONTROL</div>
              <div className="in-room-title">La room è tua adesso.</div>
              <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.64)', lineHeight: '1.45', marginTop: '6px' }}>Azioni veloci durante la sessione.</div>
            </div>
            <div className="room-status-pill"><i className="fas fa-bolt"></i> POWER ON</div>
          </div>
          <div className="quick-controls">
            <button className="quick-control" onClick={() => showPage('shop')}>
              <i className="fas fa-layer-group"></i>Pack<span>partita, snack, mood</span>
            </button>
            <button className="quick-control" onClick={handleExtend}>
              <i className="fas fa-clock"></i>+1h<span>estendi al volo</span>
            </button>
            <button className="quick-control" onClick={() => showToast({ title: 'Assistenza avvisata', copy: 'Il team riceve sessione, orario e stato accesso.' })}>
              <i className="fas fa-headset"></i>Aiuto<span>priorità sessione live</span>
            </button>
          </div>
        </div>

        <div className="chip mt-20" style={{ padding: '18px' }}>
          <div style={{ fontWeight: 900, color: '#fff', marginBottom: '8px' }}>Control room</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
        <button className="btn-neon" style={{ justifyContent: 'center' }} onClick={() => showPage('shop')}>ADDON</button>
        <button style={{ background: 'var(--dark3)', border: '1px solid rgba(200,255,0,.35)', color: 'var(--neon)' }} onClick={handleExtend}>+1H</button>
      </div>
    </div>
  )
}
