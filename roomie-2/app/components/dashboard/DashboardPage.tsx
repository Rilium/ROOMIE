'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/app/context/AppContext'
import { apiDashboard, apiExtendBooking } from '@/lib/client-api'
import type { Booking } from '@/lib/types'
import { bookingStartDate, isBookingLiveNow } from '@/lib/utils'

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    confirmed: 'CONFERMATA', pending: 'IN ATTESA', cancelled: 'ANNULLATA',
    completed: 'COMPLETATA', live: 'LIVE',
  }
  return map[s] || s.toUpperCase()
}

function statusClass(s: string) {
  const map: Record<string, string> = {
    confirmed: 's-paid', pending: 's-pending', cancelled: 's-cancelled',
    completed: 's-done', live: 's-live',
  }
  return `status-badge ${map[s] || ''}`
}

export default function DashboardPage() {
  const { user, showPage, showToast, setActiveSession } = useApp()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [sessionCount, setSessionCount] = useState(0)
  const [chipsSpent, setChipsSpent] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await apiDashboard()
    if (data) {
      setBookings(data.bookings || [])
      setSessionCount(data.sessionCount || 0)
      setChipsSpent(data.chipsSpent || 0)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleExtend = useCallback(async (id: string) => {
    const { data, error } = await apiExtendBooking(id)
    if (error) { showToast({ title: error, type: 'warn' }); return }
    showToast({ title: '+1h aggiunta!' })
    setBookings(prev => prev.map(b => b.id === id ? (data?.booking ?? b) : b))
  }, [showToast])

  const handleEnter = useCallback((b: Booking) => {
    setActiveSession({ booking: b, accessStep: 0, shutterDone: false, keyDone: false, doorDone: false })
    showPage('confirm')
  }, [setActiveSession, showPage])

  const nextBooking = bookings.find(b => ['confirmed', 'pending'].includes(b.status))
  const nextBookingLive = nextBooking ? isBookingLiveNow(nextBooking) : false
  const nextBookingStartLabel = nextBooking
    ? bookingStartDate(nextBooking).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''
  const history = bookings.filter(b => ['completed', 'cancelled'].includes(b.status))

  const buyingPower = user ? Math.floor(user.chips / 12) : 0

  const copyPartnerCode = () => {
    const code = `ROOMIE-${user?.username?.toUpperCase().slice(0, 6) || 'MB'}7724`
    navigator.clipboard.writeText(code).catch(() => {})
    showToast({ title: 'Codice partner copiato' })
  }

  const copyWifi = () => {
    navigator.clipboard.writeText('Wi-Fi: $wag_Barca\nPassword: !nexus2018.').catch(() => {})
    showToast({ title: 'Credenziali Wi-Fi copiate' })
  }

  if (!user) return null

  return (
    <div className="page active" id="page-dashboard">
      <div className="dash-header">
        <div className="dash-shell">
          <div>
            <div className="dash-kicker">Bentornato</div>
            <div className="dash-title">{user.name.toUpperCase()}, LA ROOM TI ASPETTA.</div>
            <div className="dash-sub">Da qui blocchi lo slot, inviti il gruppo, entri con i codici e gestisci chips e addon.</div>
          </div>
          <div className="dash-wallet">
            <div className="dash-balance">
              <div className="dash-bal-label">SALDO CHIPS</div>
              <div className="dash-bal-val">{user.chips} chips</div>
              <span className="roomie-chip" aria-hidden="true"></span>
              <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '4px' }}>= €{user.chips}</div>
              <div className="dash-buying-power">
                Ti bastano per {buyingPower} {buyingPower === 1 ? 'ora' : 'ore'} room.
              </div>
              <button
                onClick={() => showPage('token')}
                style={{ gridColumn: '1 / -1', background: 'rgba(200,255,0,.12)', border: '1px solid rgba(200,255,0,.32)', color: 'var(--neon)', borderRadius: '10px', padding: '10px 12px', fontWeight: 900, fontSize: '.8rem', marginTop: '4px', cursor: 'pointer' }}
              >RICARICA CHIPS</button>
            </div>
            <div className="dash-mini-grid">
              <div className="dash-mini-stat"><span>Sessioni</span><strong>{sessionCount}</strong></div>
              <div className="dash-mini-stat"><span>Chips spesi</span><strong style={{ color: 'var(--neon)' }}>{chipsSpent}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-main">

        {/* Next session launchpad */}
        {nextBooking ? (
          <>
            <div className="next-session-chip" style={{ borderColor: 'rgba(200,255,0,.3)', marginBottom: '24px' }}>
              <div className="session-kicker"><i className="fas fa-calendar-check"></i> PROSSIMA SESSIONE</div>
              <div className="session-main-title">{fmtDate(nextBooking.date)} · {nextBooking.start}→{nextBooking.end}</div>
              <div style={{ fontSize: '.92rem', color: 'rgba(255,255,255,.72)', lineHeight: '1.5', marginTop: '10px' }}>
                Room Via Terni · {nextBooking.people} persona{nextBooking.people !== 1 ? 'e' : ''} · {nextBooking.totalChips} chips
              </div>
              <div className="session-action-grid">
                <button className={nextBookingLive ? 'btn-neon' : 'quiet-action'} onClick={() => handleEnter(nextBooking)}>
                  <i className={`fas ${nextBookingLive ? 'fa-route' : 'fa-lock'}`}></i> {nextBookingLive ? 'ACCEDI ALLA ROOM' : 'ACCESSO BLOCCATO'}
                </button>
                <button className="quiet-action" onClick={() => handleExtend(nextBooking.id)}>
                  <i className="fas fa-clock"></i> +1H
                </button>
              </div>
            </div>
            {!nextBookingLive && (
              <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.58)', margin: '-14px 0 24px', lineHeight: '1.45' }}>
                Procedura cassaforte, serranda e porta attiva da {nextBookingStartLabel}.
              </div>
            )}
          </>
        ) : (
          <div className="next-session-chip session-launchpad">
            <div className="session-kicker"><i className="fas fa-calendar-plus"></i> NESSUNA SESSIONE ATTIVA</div>
            <div className="session-main-title">Blocca la prossima serata.</div>
            <div style={{ fontSize: '.92rem', color: 'rgba(255,255,255,.72)', lineHeight: '1.5', marginTop: '10px' }}>
              Scegli un preset, invita chi vuoi e arrivi con accesso, codici e addon già pronti.
            </div>
            <div className="session-action-grid">
              <button className="btn-neon" onClick={() => showPage('room')}>
                <i className="fas fa-calendar-check"></i> PRENOTA ORA
              </button>
              <button className="quiet-action" onClick={() => showPage('shop')}>
                <i className="fas fa-shopping-bag"></i> SHOP
              </button>
            </div>
          </div>
        )}

        {/* Primary grid */}
        <div className="dash-primary-grid">
          <div className="dash-partner-card">
            <div>
              <div className="dash-section-label">Partner vicino</div>
              <div className="dash-partner-code">ROOMIE-{user.username?.toUpperCase().slice(0, 6) || 'MB'}7724</div>
              <div style={{ fontSize: '.84rem', color: 'rgba(255,255,255,.64)', lineHeight: '1.45', marginTop: '8px' }}>Mostralo nei locali partner per il -10%.</div>
            </div>
            <button onClick={copyPartnerCode} className="quiet-action" style={{ borderRadius: '10px', padding: '12px', fontWeight: 900 }}>COPIA CODICE</button>
          </div>
        </div>

        {/* Tools */}
        <div className="profile-tools-grid">
          <button className="wifi-card" type="button" onClick={copyWifi} aria-label="Copia Wi-Fi">
            <div className="wifi-icon"><i className="fas fa-wifi"></i></div>
            <div className="dash-section-label">Wi-Fi del posto</div>
            <div className="wifi-title">ROOMIE NETWORK</div>
            <div className="wifi-row"><span>Username</span><span>$wag_Barca</span></div>
            <div className="wifi-row"><span>Password</span><span>!nexus2018.</span></div>
            <div className="wifi-copy-hint"><i className="fas fa-copy"></i> Tocca per copiare</div>
          </button>
          <div className="camera-card is-locked" aria-label="Telecamera live">
            <div className="camera-feed"></div>
            <div className="camera-overlay">
              <div>
                <div className="camera-top">
                  <div className="camera-live">Bloccata</div>
                  <div className="camera-roomie">ROOMIE CAM</div>
                </div>
              </div>
              <div>
                <div className="camera-title">CONTROLLO LIVE ROOMIE</div>
              </div>
            </div>
            <div className="camera-lock-overlay">
              <div className="camera-lock-panel">
                <div className="camera-lock-kicker">Accesso richiesto</div>
                <div className="camera-lock-title">Cam disponibile quando sei dentro.</div>
                <div className="camera-lock-copy">
                  {nextBookingLive
                    ? 'Completa l’accesso fisico: poi la live cam si sblocca qui.'
                    : nextBooking
                      ? `Live cam e accesso si attivano da ${nextBookingStartLabel}.`
                      : 'Prenota uno slot: la live cam si sblocca solo durante la sessione.'}
                </div>
                <button className="camera-lock-btn" type="button" onClick={() => nextBooking ? handleEnter(nextBooking) : showPage('room')}>
                  <i className={`fas ${nextBookingLive ? 'fa-route' : 'fa-lock'}`}></i> {nextBookingLive ? 'APRI PROCEDURA ACCESSO' : nextBooking ? 'VEDI SLOT' : 'PRENOTA'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Storico */}
        {loading ? (
          <div className="page-skeleton" aria-hidden="true">
            <div className="page-skeleton-header">
              <div className="roomie-skeleton roomie-skeleton-bar lg shimmer" style={{ width: '42%' }}></div>
              <div className="roomie-skeleton roomie-skeleton-bar shimmer" style={{ width: '68%' }}></div>
            </div>
            <div className="page-skeleton-grid">
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
            </div>
            <div className="roomie-skeleton page-skeleton-card shimmer" style={{ minHeight: '180px' }}></div>
            <div className="page-skeleton-stack">
              <div className="roomie-skeleton roomie-skeleton-bar shimmer" style={{ width: '96%' }}></div>
              <div className="roomie-skeleton roomie-skeleton-bar shimmer" style={{ width: '88%' }}></div>
              <div className="roomie-skeleton roomie-skeleton-bar sm shimmer" style={{ width: '74%' }}></div>
            </div>
          </div>
        ) : history.length > 0 && (
          <>
            <div className="dash-section-label">Storico</div>
            {history.map(b => (
              <div key={b.id} className="bk-chip" style={{ marginBottom: '10px' }}>
                <div className="bk-date">
                  <div className="bk-day">{new Date(b.date + 'T12:00:00').getDate()}</div>
                  <div className="bk-month">{new Date(b.date + 'T12:00:00').toLocaleDateString('it-IT', { month: 'short' }).toUpperCase()}</div>
                </div>
                <div className="bk-info">
                  <div className="bk-room">Room Via Terni · Torino</div>
                  <div className="bk-time">{b.start} → {b.end} · {b.people} persona{b.people !== 1 ? 'e' : ''}</div>
                </div>
                <div>
                  <div className="bk-price">{b.totalChips} chips</div>
                  <div className={statusClass(b.status)} style={{ marginTop: '4px' }}>{statusLabel(b.status)}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
