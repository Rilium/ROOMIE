'use client'

import { useState, useRef } from 'react'
import { useApp } from '@/app/context/AppContext'
import { apiLogin, apiRegister } from '@/lib/client-api'

export default function AuthScreen() {
  const { authOpen, authMode, setAuthMode, closeAuth, setUser, showPage, showToast } = useApp()

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Login refs
  const loginUsernameRef = useRef<HTMLInputElement>(null)
  const loginPasswordRef = useRef<HTMLInputElement>(null)
  const loginRememberRef = useRef<HTMLInputElement>(null)

  // Register refs
  const regNameRef = useRef<HTMLInputElement>(null)
  const regUsernameRef = useRef<HTMLInputElement>(null)
  const regEmailRef = useRef<HTMLInputElement>(null)
  const regPasswordRef = useRef<HTMLInputElement>(null)
  const regRememberRef = useRef<HTMLInputElement>(null)
  const acceptTermsRef = useRef<HTMLInputElement>(null)
  const acceptPrivacyRef = useRef<HTMLInputElement>(null)

  const errMsg: Record<string, string> = {
    BAD_CREDENTIALS: 'Username o password errati.',
    USERNAME_TAKEN: 'Username già in uso.',
    EMAIL_TAKEN: 'Email già registrata.',
    BAD_USERNAME: 'Username non valido (3-20 caratteri, solo lettere minuscole, numeri e _).',
    BAD_EMAIL: 'Email non valida.',
    WEAK_PASSWORD: 'Password troppo corta (minimo 8 caratteri).',
    BAD_NAME: 'Nome troppo corto.',
    USER_SUSPENDED: 'Account sospeso. Contatta il supporto.',
    TERMS_REQUIRED: 'Devi accettare i Termini e la Privacy Policy.',
    SOCIAL_STATE_ERROR: 'Sessione Google scaduta. Riprova.',
    GOOGLE_REDIRECT_MISMATCH: 'Callback Google non autorizzata.',
    GOOGLE_SECRET_INVALID: 'Configurazione Google non valida.',
    GOOGLE_CANCELLED: 'Accesso Google annullato.',
    GOOGLE_PROFILE_ERROR: 'Google non ha restituito un profilo valido.',
    GOOGLE_TOKEN_ERROR: 'Google non ha completato il login. Riprova.',
    SOCIAL_LOGIN_ERROR: 'Accesso Google non riuscito. Riprova.',
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const username = loginUsernameRef.current?.value.trim() || ''
    const password = loginPasswordRef.current?.value || ''
    const remember = loginRememberRef.current?.checked ?? true

    const { data, error: err } = await apiLogin(username, password, remember)
    setBusy(false)
    if (err || !data?.user) {
      setError(errMsg[err || ''] || 'Errore di accesso. Riprova.')
      return
    }
    setUser(data.user)
    closeAuth()
    showToast({ title: `Bentornato, ${data.user.name.split(' ')[0]}!` })
    showPage('dashboard')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!acceptTermsRef.current?.checked || !acceptPrivacyRef.current?.checked) {
      setError(errMsg.TERMS_REQUIRED)
      return
    }
    setBusy(true)
    const name = regNameRef.current?.value.trim() || ''
    const username = regUsernameRef.current?.value.trim() || ''
    const email = regEmailRef.current?.value.trim() || ''
    const password = regPasswordRef.current?.value || ''
    const remember = regRememberRef.current?.checked ?? true

    const { data, error: err } = await apiRegister(name, username, email, password, remember)
    setBusy(false)
    if (err || !data?.user) {
      setError(errMsg[err || ''] || 'Registrazione fallita. Riprova.')
      return
    }
    setUser(data.user)
    closeAuth()
    showToast({ title: `Benvenuto, ${data.user.name.split(' ')[0]}! 🏠` })
    showPage('dashboard')
  }

  const handleGoogle = () => {
    window.location.href = '/api/auth/google'
  }

  const openLegalDoc = (type: string) => {
    if (typeof (window as any).openLegalDoc === 'function') (window as any).openLegalDoc(type)
  }

  if (!authOpen) return null

  return (
    <div className="login-page" id="auth-screen">
      <div className="login-shell container py-4">

        <section className="auth-landing" aria-label="Roomie accesso">
          <div>
            <div className="auth-kicker"><i className="fas fa-lock-open"></i> Clubhouse privata · Torino</div>
            <div className="login-brand">ROOMIE</div>
            <div className="login-title">LA TUA SERATA, GIA&apos; PRONTA.</div>
            <div className="login-sub">Prenoti a ore, inviti chi vuoi, entri con chip fisica o codice. Gaming, film, partite e addon senza dover organizzare mezzo mondo.</div>
            <div className="auth-proof-grid">
              <div className="auth-proof"><strong>40 m2</strong><span>Via Terni, setup privato per il tuo gruppo.</span></div>
              <div className="auth-proof"><strong>8 max</strong><span>Amici, split e guest pass nello stesso flusso.</span></div>
              <div className="auth-proof"><strong>Live</strong><span>Disponibilita&apos;, accesso e saldo sempre chiari.</span></div>
            </div>
          </div>
          <div className="auth-live-card">
            <div className="auth-live-row">
              <div>
                <div className="auth-live-title">Prossimo slot consigliato</div>
                <div className="auth-live-meta">Stasera · 20:00-22:00 · Ranked Session</div>
              </div>
              <span className="auth-live-status">Libero</span>
            </div>
          </div>
        </section>

        <section className="auth-panel" aria-label="Accesso account">
          <button
            className="modal-close auth-modal-close"
            onClick={closeAuth}
            aria-label="Chiudi login"
          >
            <i className="fas fa-times"></i>
          </button>

          <div className="auth-panel-head">
            <div>
              <div className="auth-panel-title">{authMode === 'login' ? 'Accedi' : 'Registrati'}</div>
              <div className="auth-panel-sub">Account, chips e prenotazioni in un posto solo.</div>
            </div>
            <div className="auth-panel-chip">
              <span className="roomie-chip roomie-chip-sm" aria-hidden="true"></span>
            </div>
          </div>

          <div className="auth-tabs" role="tablist">
            <button
              className={`auth-tab${authMode === 'login' ? ' active' : ''}`}
              type="button"
              onClick={() => { setAuthMode('login'); setError('') }}
            >Login</button>
            <button
              className={`auth-tab${authMode === 'register' ? ' active' : ''}`}
              type="button"
              onClick={() => { setAuthMode('register'); setError('') }}
            >Registrati</button>
          </div>

          {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}

          {/* LOGIN FORM */}
          {authMode === 'login' && (
            <form className="auth-form active" onSubmit={handleLogin}>
              <div className="social-auth">
                <button className="social-btn google" type="button" onClick={handleGoogle}>
                  <i className="fab fa-google"></i> Continua con Google
                </button>
              </div>
              <div className="auth-divider">oppure</div>
              <div className="form-group mb-3">
                <label className="form-label">USERNAME O EMAIL</label>
                <input
                  ref={loginUsernameRef}
                  className="form-input"
                  autoComplete="username"
                  placeholder="es. marco"
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label">PASSWORD</label>
                <input
                  ref={loginPasswordRef}
                  className="form-input"
                  autoComplete="current-password"
                  type="password"
                  placeholder="La tua password"
                />
              </div>
              <label className="auth-check">
                <input ref={loginRememberRef} type="checkbox" defaultChecked /> Resta collegato su questo dispositivo
              </label>
              <button
                className="btn-neon btn-neon-submit w-full"
                type="submit"
                disabled={busy}
              >
                {busy ? 'Accesso...' : 'LOGIN'}
              </button>
              <div className="auth-footnote">Accesso protetto. Le tue chips e prenotazioni restano nel profilo.</div>
            </form>
          )}

          {/* REGISTER FORM */}
          {authMode === 'register' && (
            <form className="auth-form active" onSubmit={handleRegister}>
              <div className="social-auth">
                <button className="social-btn google" type="button" onClick={handleGoogle}>
                  <i className="fab fa-google"></i> Registrati con Google
                </button>
              </div>
              <div className="auth-divider">oppure</div>
              <div className="form-group mb-3">
                <label className="form-label">NOME</label>
                <input
                  ref={regNameRef}
                  className="form-input"
                  autoComplete="name"
                  placeholder="Es. Marco Bianchi"
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label">USERNAME</label>
                <input
                  ref={regUsernameRef}
                  className="form-input"
                  autoComplete="username"
                  placeholder="3-20 caratteri, es. marco_b"
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label">EMAIL</label>
                <input
                  ref={regEmailRef}
                  className="form-input"
                  autoComplete="email"
                  type="email"
                  placeholder="nome@email.com"
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label">PASSWORD</label>
                <input
                  ref={regPasswordRef}
                  className="form-input"
                  autoComplete="new-password"
                  type="password"
                  placeholder="Minimo 8 caratteri"
                />
              </div>
              <div className="legal-consents">
                <label className="legal-consent">
                  <input ref={acceptTermsRef} type="checkbox" />
                  <span>Accetto i <button type="button" onClick={() => openLegalDoc('terms')}>Termini e Condizioni</button>.</span>
                </label>
                <label className="legal-consent">
                  <input ref={acceptPrivacyRef} type="checkbox" />
                  <span>Ho letto la <button type="button" onClick={() => openLegalDoc('privacy')}>Privacy Policy</button>.</span>
                </label>
              </div>
              <label className="auth-check">
                <input ref={regRememberRef} type="checkbox" defaultChecked /> Crea cookie sessione persistente
              </label>
              <button
                className="btn-neon btn-neon-submit w-full"
                type="submit"
                disabled={busy}
              >
                {busy ? 'Registrazione...' : 'CREA ACCOUNT'}
              </button>
              <div className="auth-footnote">Le chips di benvenuto vengono aggiunte subito al tuo profilo.</div>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
