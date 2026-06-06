'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useClerk, useUser } from '@clerk/nextjs'
import { useApp } from '@/app/context/AppContext'
import { apiDashboard, apiExtendBooking, apiRevokeLegal, apiRoomWifi, apiUpdateProfile } from '@/lib/client-api'
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
  const { user, setUser, showPage, showToast, setActiveSession, openLegalDoc, logout } = useApp()
  const clerk = useClerk()
  const { user: clerkUser } = useUser()
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [sessionCount, setSessionCount] = useState(0)
  const [chipsSpent, setChipsSpent] = useState(0)
  const [wifi, setWifi] = useState<{ ssid: string; password: string; configured: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [profileName, setProfileName] = useState('')
  const [profileUsername, setProfileUsername] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [accountBusy, setAccountBusy] = useState(false)
  const [legalExitOpen, setLegalExitOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('DASHBOARD_TIMEOUT')), 8000)
      })
      const { data, error } = await Promise.race([apiDashboard(), timeout])
      if (data) {
        setBookings(data.bookings || [])
        setSessionCount(data.sessionCount || 0)
        setChipsSpent(data.chipsSpent || 0)
      } else if (error) {
        setLoadError(error)
      }
    } catch {
      setLoadError('DASHBOARD_TIMEOUT')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!user) return
    setProfileName(user.name || '')
    setProfileUsername(user.username || '')
  }, [user])
  useEffect(() => {
    apiRoomWifi().then(({ data }) => {
      if (data?.wifi) setWifi(data.wifi)
    })
  }, [])

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
  const avatarUrl = clerkUser?.imageUrl || user?.avatar || ''
  const profileInitials = (user?.name || user?.username || 'R')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'R'
  const legalAccepted = Boolean(user?.termsAcceptedAt && user?.privacyAcceptedAt)
  const documentStatus = user?.documentVerificationStatus || 'missing'
  const documentLabel = user?.documentType === 'driver_license' ? 'Patente' : 'Carta identita'

  const copyPartnerCode = () => {
    const code = `ROOMIE-${user?.username?.toUpperCase().slice(0, 6) || 'MB'}7724`
    navigator.clipboard.writeText(code).catch(() => {})
    showToast({ title: 'Codice partner copiato' })
  }

  const copyWifi = () => {
    if (!wifi?.configured) {
      showToast({ title: 'Wi-Fi non configurato', copy: 'Le credenziali saranno disponibili in sessione.', type: 'warn' })
      return
    }
    navigator.clipboard.writeText(`Wi-Fi: ${wifi.ssid}\nPassword: ${wifi.password}`).catch(() => {})
    showToast({ title: 'Credenziali Wi-Fi copiate' })
  }

  const saveProfile = async () => {
    setProfileBusy(true)
    const { data, error } = await apiUpdateProfile({ name: profileName, username: profileUsername })
    if (!error && data?.user && clerkUser) {
      await (clerkUser as unknown as { update?: (params: Record<string, unknown>) => Promise<unknown> }).update?.({
        firstName: profileName.trim().split(/\s+/)[0] || undefined,
        lastName: profileName.trim().split(/\s+/).slice(1).join(' ') || undefined,
        username: profileUsername.trim() || undefined,
        unsafeMetadata: {
          ...(clerkUser.unsafeMetadata || {}),
          roomieDisplayName: profileName.trim(),
          roomieUsername: profileUsername.trim(),
        },
      }).catch(() => null)
    }
    setProfileBusy(false)
    if (error || !data?.user) {
      const msgs: Record<string, string> = {
        BAD_NAME: 'Nome troppo corto.',
        BAD_USERNAME: 'Username non valido: usa 3-24 caratteri.',
        USERNAME_TAKEN: 'Username gia in uso.',
      }
      showToast({ title: msgs[error || ''] || 'Impossibile salvare il profilo.', type: 'warn' })
      return
    }
    setUser(data.user)
    showToast({ title: 'Profilo aggiornato' })
  }

  const updateAvatar = async (file: File | null) => {
    if (!file || !clerkUser) return
    setAvatarBusy(true)
    try {
      await (clerkUser as unknown as { setProfileImage?: (params: { file: File }) => Promise<unknown> }).setProfileImage?.({ file })
      await clerkUser.reload?.()
      showToast({ title: 'Immagine profilo aggiornata' })
    } catch {
      showToast({ title: 'Impossibile aggiornare immagine profilo', type: 'warn' })
    } finally {
      setAvatarBusy(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const deleteAccount = async () => {
    if (!window.confirm('Eliminare definitivamente il tuo account Clerk? Questa azione non si puo annullare.')) return
    setAccountBusy(true)
    try {
      const deletable = clerkUser as unknown as { delete?: () => Promise<unknown> }
      if (deletable.delete) {
        await deletable.delete()
        await logout()
      } else {
        clerk.openUserProfile?.()
      }
    } catch {
      showToast({ title: 'Eliminazione account non disponibile ora', copy: 'Apri Account Clerk e riprova dalla sezione sicurezza.', type: 'warn' })
      clerk.openUserProfile?.()
    } finally {
      setAccountBusy(false)
    }
  }

  const revokeLegalAndExit = async () => {
    setAccountBusy(true)
    const { data, error } = await apiRevokeLegal()
    if (data?.user) setUser(data.user)
    setLegalExitOpen(false)
    setAccountBusy(false)
    if (error) {
      showToast({ title: 'Non riesco a revocare i consensi ora', type: 'warn' })
      return
    }
    showToast({ title: 'Consensi revocati', copy: 'Esci ora. Al prossimo ingresso Roomie li richiedera di nuovo.' })
    await logout()
  }

  if (!user) {
    return (
      <div className="page active" id="page-dashboard">
        <div className="dash-main">
          <div className="page-skeleton" aria-label="Caricamento profilo">
            <div className="roomie-skeleton page-skeleton-card shimmer" style={{ minHeight: '220px' }}></div>
            <div className="page-skeleton-grid">
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
        {loadError && (
          <div className="shop-locked-banner" style={{ display: 'block' }}>
            <strong>Profilo lento a rispondere.</strong> Alcuni dati potrebbero arrivare tra poco. Puoi riprovare senza restare su schermata nera.
            <button type="button" className="shop-lock-cta" onClick={load}>RICARICA PROFILO</button>
          </div>
        )}

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

        <section className="profile-revolut-card">
          <div className="profile-hero-row">
            <div className="profile-avatar-wrap">
              <button className="profile-avatar" type="button" onClick={() => avatarInputRef.current?.click()} aria-label="Cambia immagine profilo">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{profileInitials}</span>}
                <i className={`fas ${avatarBusy ? 'fa-spinner fa-spin' : 'fa-camera'}`}></i>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="profile-avatar-input"
                onChange={event => updateAvatar(event.target.files?.[0] || null)}
              />
            </div>
            <div className="profile-identity">
              <div className="dash-section-label">Profilo Roomie</div>
              <h2>{user.name}</h2>
              <div className="profile-handle">@{user.username}</div>
              <div className="profile-pill-row">
                <span className={`profile-pill ${user.role === 'admin' ? 'hot' : ''}`}>{user.role}</span>
                <span className="profile-pill">{user.chips} chips</span>
                <span className={`profile-pill ${legalAccepted ? 'ok' : 'warn'}`}>{legalAccepted ? 'consensi ok' : 'consensi richiesti'}</span>
              </div>
            </div>
            <button className="profile-upgrade" type="button" onClick={() => showPage('token')}>
              <i className="fas fa-gem"></i> Ricarica
            </button>
          </div>

          <div className="profile-action-grid">
            <button type="button" className="profile-action-tile" onClick={() => clerk.openUserProfile?.()}>
              <i className="fas fa-user-shield"></i>
              <strong>Account Clerk</strong>
              <span>Email, password, MFA</span>
            </button>
            <button type="button" className="profile-action-tile" onClick={() => showPage('token')}>
              <i className="fas fa-wallet"></i>
              <strong>Wallet</strong>
              <span>{user.chips} chips disponibili</span>
            </button>
          </div>

          <div className="profile-panel">
            <div className="profile-panel-title">
              <i className="fas fa-id-badge"></i>
              <span>Dati Roomie</span>
            </div>
            <div className="profile-edit-grid">
              <label className="profile-field">
                <span>Nome visualizzato</span>
                <input className="form-input" value={profileName} onChange={e => setProfileName(e.target.value)} />
              </label>
              <label className="profile-field">
                <span>Username</span>
                <input className="form-input" value={profileUsername} onChange={e => setProfileUsername(e.target.value)} />
              </label>
            </div>
            <div className="profile-data-actions">
              <button className="btn-neon" type="button" onClick={saveProfile} disabled={profileBusy}>
                {profileBusy ? 'SALVO...' : 'SALVA DATI'}
              </button>
              <button className="quiet-action" type="button" onClick={() => clerk.openUserProfile?.()}>
                MODIFICA DATI CLERK
              </button>
            </div>
          </div>

          <div className="profile-menu-list">
            <div className="profile-menu-row">
              <i className="fas fa-address-card"></i>
              <div>
                <strong>Documento identita</strong>
                <span>
                  {documentStatus === 'mock_verified' || documentStatus === 'verified'
                    ? `${documentLabel} · ${user.documentName || user.name} · ${user.documentLast4 || '----'}`
                    : 'Documento non verificato'}
                </span>
              </div>
              <em className={`profile-status ${documentStatus === 'mock_verified' || documentStatus === 'verified' ? 'ok' : 'warn'}`}>
                {documentStatus === 'mock_verified' ? 'verificato demo' : documentStatus}
              </em>
            </div>

            <button className="profile-menu-row as-button" type="button" onClick={() => user.termsAcceptedAt ? setLegalExitOpen(true) : openLegalDoc('terms')}>
              <i className="fas fa-file-signature"></i>
              <div>
                <strong>Termini e condizioni</strong>
                <span>{user.termsAcceptedAt ? `Attivi dal ${new Date(user.termsAcceptedAt).toLocaleDateString('it-IT')} · tocca per revocare` : 'Da accettare'}</span>
              </div>
              <span className={`profile-switch ${user.termsAcceptedAt ? 'on' : ''}`} aria-hidden="true"></span>
            </button>

            <button className="profile-menu-row as-button" type="button" onClick={() => user.privacyAcceptedAt ? setLegalExitOpen(true) : openLegalDoc('privacy')}>
              <i className="fas fa-shield-halved"></i>
              <div>
                <strong>Privacy policy</strong>
                <span>{user.privacyAcceptedAt ? `Attiva dal ${new Date(user.privacyAcceptedAt).toLocaleDateString('it-IT')} · tocca per revocare` : 'Da accettare'}</span>
              </div>
              <span className={`profile-switch ${user.privacyAcceptedAt ? 'on' : ''}`} aria-hidden="true"></span>
            </button>

            <button className="profile-menu-row as-button danger-lite" type="button" onClick={() => setLegalExitOpen(true)}>
              <i className="fas fa-toggle-off"></i>
              <div>
                <strong>Revoca consensi</strong>
                <span>Esci dal sito e li richiediamo al prossimo accesso</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </button>

            <button className="profile-menu-row as-button danger" type="button" onClick={deleteAccount} disabled={accountBusy}>
              <i className="fas fa-user-xmark"></i>
              <div>
                <strong>Elimina account</strong>
                <span>Cancella l'account Clerk quando disponibile</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </section>

        {legalExitOpen && (
          <div className="profile-consent-modal" role="dialog" aria-modal="true" aria-label="Revoca consensi">
            <div className="profile-consent-box">
              <div className="profile-consent-icon"><i className="fas fa-door-open"></i></div>
              <h3>Se togli i consensi esci da Roomie.</h3>
              <p>Senza Termini e Privacy attivi non puoi restare nel sito. Ti faccio uscire ora; al prossimo ingresso Roomie te li richiedera prima di usare prenotazioni, shop e accesso.</p>
              <div className="profile-consent-actions">
                <button type="button" className="quiet-action" onClick={() => setLegalExitOpen(false)}>ANNULLA</button>
                <button type="button" className="btn-neon" onClick={revokeLegalAndExit} disabled={accountBusy}>
                  {accountBusy ? 'ESCO...' : 'REVOCA ED ESCI'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tools */}
        <div className="profile-tools-grid">
          <button className="wifi-card" type="button" onClick={copyWifi} aria-label="Copia Wi-Fi">
            <div className="wifi-icon"><i className="fas fa-wifi"></i></div>
            <div className="dash-section-label">Wi-Fi del posto</div>
            <div className="wifi-title">ROOMIE NETWORK</div>
            <div className="wifi-row"><span>Nome rete</span><span>{wifi?.configured ? wifi.ssid : 'Disponibile in room'}</span></div>
            <div className="wifi-row"><span>Password</span><span>{wifi?.configured ? 'Tocca per copiare' : 'Protetta'}</span></div>
            <div className="wifi-copy-hint"><i className="fas fa-copy"></i> {wifi?.configured ? 'Tocca per copiare' : 'Solo da account attivo'}</div>
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
