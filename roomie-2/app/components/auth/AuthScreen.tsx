'use client'

import { useState, useRef } from 'react'
import { useSignIn, useSignUp } from '@clerk/nextjs/legacy'
import { useApp } from '@/app/context/AppContext'
import { apiMe } from '@/lib/client-api'

export default function AuthScreen() {
  const { authOpen, authMode, setAuthMode, closeAuth, setUser, showPage, showToast, openLegalDoc } = useApp()
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn()
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp()

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)

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
    form_identifier_not_found:      'Username o email non trovati.',
    form_password_incorrect:        'Password errata.',
    form_identifier_exists:         'Email o username già in uso.',
    form_password_length_too_short: 'Password troppo corta (minimo 8 caratteri).',
    form_password_pwned:            'Password non sicura. Scegline una più complessa.',
    USER_SUSPENDED:                 'Account sospeso. Contatta il supporto.',
    TERMS_REQUIRED:                 'Devi accettare i Termini e la Privacy Policy.',
  }

  function clerkErrMsg(err: unknown): string {
    const e = err as { errors?: Array<{ code: string; message?: string }> }
    const code = e?.errors?.[0]?.code ?? ''
    const msg  = e?.errors?.[0]?.message ?? ''
    console.error('[Clerk error]', code, msg, err)
    return errMsg[code] ?? `Errore (${code || 'unknown'}): ${msg || 'Riprova.'}`
  }

  const afterAuth = async (
    sessionId: string,
    setActiveFn: ((opts: { session: string }) => Promise<void>) | undefined,
    isRegister = false
  ) => {
    await setActiveFn?.({ session: sessionId })
    const meRes = await apiMe()
    const user = meRes.data?.user ?? null
    if (user) {
      setUser(user)
      closeAuth()
      showToast({ title: isRegister ? `Benvenuto, ${user.name.split(' ')[0]}! 🏠` : `Bentornato, ${user.name.split(' ')[0]}!` })
      showPage('dashboard')
    } else {
      setError('Account creato, ma profilo non trovato. Riprova.')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signInLoaded || !signIn) return
    setError('')
    setBusy(true)
    const identifier = loginUsernameRef.current?.value.trim() ?? ''
    const password   = loginPasswordRef.current?.value ?? ''
    try {
      const result = await signIn.create({ identifier, password })
      if (result.status === 'complete') {
        await afterAuth(result.createdSessionId!, setActiveSignIn)
      } else {
        setError('Verifica la tua email prima di accedere.')
      }
    } catch (err) {
      setError(clerkErrMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signUpLoaded || !signUp) return
    setError('')
    if (!acceptTermsRef.current?.checked || !acceptPrivacyRef.current?.checked) {
      setError(errMsg.TERMS_REQUIRED)
      return
    }
    setBusy(true)
    const name     = regNameRef.current?.value.trim() ?? ''
    const username = regUsernameRef.current?.value.trim() ?? ''
    const email    = regEmailRef.current?.value.trim() ?? ''
    const password = regPasswordRef.current?.value ?? ''
    try {
      const result = await signUp.create({
        emailAddress: email,
        password,
        username: username || undefined,
        firstName: name || undefined,
      })
      if (result.status === 'complete') {
        await afterAuth(result.createdSessionId!, setActiveSignUp, true)
      } else {
        setError('Controlla la tua email e clicca il link di verifica, poi accedi.')
      }
    } catch (err) {
      setError(clerkErrMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const handleGoogle = async () => {
    if (!signInLoaded || !signIn) { window.location.href = '/sign-in'; return }
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/dashboard',
      })
    } catch {
      window.location.href = '/sign-in'
    }
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
                <div className="password-field">
                  <input
                    ref={loginPasswordRef}
                    className="form-input"
                    autoComplete="current-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="La tua password"
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowLoginPassword(v => !v)} aria-label={showLoginPassword ? 'Nascondi password' : 'Mostra password'}>
                    <i className={`fas ${showLoginPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
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
                <div className="password-field">
                  <input
                    ref={regPasswordRef}
                    className="form-input"
                    autoComplete="new-password"
                    type={showRegisterPassword ? 'text' : 'password'}
                    placeholder="Minimo 8 caratteri"
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowRegisterPassword(v => !v)} aria-label={showRegisterPassword ? 'Nascondi password' : 'Mostra password'}>
                    <i className={`fas ${showRegisterPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
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
              {/* Clerk CAPTCHA — obbligatorio per headless sign-up con bot protection */}
              <div id="clerk-captcha" />
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
