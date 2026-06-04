'use client'

import { useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useSignIn, useSignUp } from '@clerk/nextjs/legacy'
import { useApp } from '@/app/context/AppContext'
import { apiMe } from '@/lib/client-api'

type ForgotStep = 'email' | 'code' | 'done'

export default function AuthScreen() {
  const { authOpen, authMode, setAuthMode, closeAuth, setUser, showPage, showToast, openLegalDoc } = useApp()
  const { getToken } = useAuth()
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn()
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp()

  const [error, setError]                           = useState('')
  const [busy, setBusy]                             = useState(false)
  const [showLoginPassword, setShowLoginPassword]   = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showNewPassword, setShowNewPassword]       = useState(false)
  const [forgotStep, setForgotStep]                 = useState<ForgotStep | null>(null)
  const [verifyingEmail, setVerifyingEmail]         = useState(false) // after signUp, waiting for code

  // Login refs
  const loginEmailRef    = useRef<HTMLInputElement>(null)
  const loginPasswordRef = useRef<HTMLInputElement>(null)
  const loginRememberRef = useRef<HTMLInputElement>(null)

  // Register refs
  const regNameRef       = useRef<HTMLInputElement>(null)
  const regUsernameRef   = useRef<HTMLInputElement>(null)
  const regEmailRef      = useRef<HTMLInputElement>(null)
  const regPasswordRef   = useRef<HTMLInputElement>(null)
  const regRememberRef   = useRef<HTMLInputElement>(null)
  const acceptTermsRef   = useRef<HTMLInputElement>(null)
  const acceptPrivacyRef = useRef<HTMLInputElement>(null)
  const verifyCodeRef    = useRef<HTMLInputElement>(null)

  // Forgot password refs
  const forgotEmailRef = useRef<HTMLInputElement>(null)
  const forgotCodeRef  = useRef<HTMLInputElement>(null)
  const newPasswordRef = useRef<HTMLInputElement>(null)

  const errMsg: Record<string, string> = {
    form_identifier_not_found:             'Email non trovata.',
    form_password_incorrect:               'Password errata.',
    form_identifier_exists:                'Email già registrata.',
    form_param_format_invalid:             'Formato non valido. Usa una email, es. nome@email.com',
    form_password_length_too_short:        'Password troppo corta (minimo 8 caratteri).',
    form_password_pwned:                   'Password non sicura. Scegline una più complessa.',
    form_code_incorrect:                   'Codice non corretto.',
    form_code_expired:                     'Codice scaduto. Richiedi un nuovo reset.',
    verification_expired:                  'Codice scaduto. Riprova la registrazione.',
    verification_failed:                   'Verifica fallita. Riprova.',
    USER_SUSPENDED:                        'Account sospeso. Contatta il supporto.',
    TERMS_REQUIRED:                        'Devi accettare i Termini e la Privacy Policy.',
  }

  function clerkErrMsg(err: unknown): string {
    const e = err as { errors?: Array<{ code: string; message?: string }> }
    const code = e?.errors?.[0]?.code ?? ''
    const msg  = e?.errors?.[0]?.message ?? ''
    console.error('[Clerk error]', code, msg, err)
    return errMsg[code] ?? `Errore: ${msg || 'Riprova.'}`
  }

  const fetchUser = async (token?: string | null) => {
    await new Promise(r => setTimeout(r, 300))
    for (let i = 0; i < 5; i++) {
      const meRes = await apiMe(token ?? undefined)
      const u = meRes.data?.user ?? null
      if (u) return u
      // On retry, attempt to get a fresh token in case it wasn't ready yet
      if (i === 0) {
        try { token = await getToken() } catch {}
      }
      await new Promise(r => setTimeout(r, 400 + i * 200))
    }
    return null
  }

  const afterAuth = async (
    sessionId: string,
    setActiveFn: ((opts: { session: string }) => Promise<void>) | undefined,
    isRegister = false
  ) => {
    await setActiveFn?.({ session: sessionId })
    // Get token immediately after session activation — bypasses cookie timing issues
    let token: string | null = null
    try { token = await getToken() } catch {}
    const user = await fetchUser(token)
    if (user) {
      setUser(user)
      closeAuth()
      showToast({ title: isRegister ? `Benvenuto, ${user.name.split(' ')[0]}! 🏠` : `Bentornato, ${user.name.split(' ')[0]}!` })
      showPage('dashboard')
    } else {
      window.location.href = '/dashboard'
    }
  }

  const handleSessionExists = async () => {
    const user = await fetchUser()
    if (user) { setUser(user); closeAuth(); showPage('dashboard') }
    else window.location.href = '/dashboard'
  }

  // ── LOGIN ───────────────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signInLoaded || !signIn) return
    setError('')
    setBusy(true)
    const identifier = loginEmailRef.current?.value.trim() ?? ''
    const password   = loginPasswordRef.current?.value ?? ''
    try {
      const result = await signIn.create({ identifier, password })
      if (result.status === 'complete') {
        await afterAuth(result.createdSessionId!, setActiveSignIn)
      } else {
        setError('Verifica la tua email prima di accedere.')
      }
    } catch (err) {
      const code = (err as { errors?: Array<{ code: string }> })?.errors?.[0]?.code
      if (code === 'session_exists') { await handleSessionExists(); setBusy(false); return }
      setError(clerkErrMsg(err))
    } finally {
      setBusy(false)
    }
  }

  // ── REGISTER ────────────────────────────────────────────────────────────────

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
      } else if (result.status === 'missing_requirements') {
        // Email verification required — prepare and show code input
        const unverified = result.unverifiedFields ?? []
        if (unverified.includes('email_address')) {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
        }
        setVerifyingEmail(true)
      } else {
        setError('Stato inatteso. Riprova.')
      }
    } catch (err) {
      const code = (err as { errors?: Array<{ code: string }> })?.errors?.[0]?.code
      if (code === 'session_exists') { await handleSessionExists(); setBusy(false); return }
      setError(clerkErrMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signUpLoaded || !signUp) return
    setError('')
    setBusy(true)
    const code = verifyCodeRef.current?.value.trim() ?? ''
    try {
      const result = await signUp.attemptEmailAddressVerification({ code })
      if (result.status === 'complete') {
        await afterAuth(result.createdSessionId!, setActiveSignUp, true)
      } else {
        setError('Verifica non completata. Riprova.')
      }
    } catch (err) {
      setError(clerkErrMsg(err))
    } finally {
      setBusy(false)
    }
  }

  // ── GOOGLE ──────────────────────────────────────────────────────────────────

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

  // ── FORGOT PASSWORD ─────────────────────────────────────────────────────────

  const handleForgotSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signInLoaded || !signIn) return
    setError('')
    setBusy(true)
    const identifier = forgotEmailRef.current?.value.trim() ?? ''
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier })
      setForgotStep('code')
    } catch (err) {
      setError(clerkErrMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const handleForgotConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signInLoaded || !signIn) return
    setError('')
    setBusy(true)
    const code     = forgotCodeRef.current?.value.trim() ?? ''
    const password = newPasswordRef.current?.value ?? ''
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      })
      if (result.status === 'complete') {
        await setActiveSignIn?.({ session: result.createdSessionId! })
        let forgotToken: string | null = null
        try { forgotToken = await getToken() } catch {}
        const user = await fetchUser(forgotToken)
        if (user) {
          setUser(user)
          closeAuth()
          showToast({ title: `Bentornato, ${user.name.split(' ')[0]}! Password aggiornata.` })
          showPage('dashboard')
        } else {
          window.location.href = '/dashboard'
        }
      } else {
        setForgotStep('done')
      }
    } catch (err) {
      setError(clerkErrMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const exitForgot = () => { setForgotStep(null); setError('') }

  if (!authOpen) return null

  return (
    <div className="login-page" id="auth-screen">
      {/* Clerk CAPTCHA — must always be in DOM for Clerk to mount the widget */}
      <div id="clerk-captcha" style={{ position: 'fixed', bottom: 0, left: 0, zIndex: 99999 }} />

      <div className="login-shell container py-4">

        {/* ── AUTH LANDING (sinistra) ── */}
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

        {/* ── AUTH PANEL (destra) ── */}
        <section className="auth-panel" aria-label="Accesso account">
          <button className="modal-close auth-modal-close" onClick={closeAuth} aria-label="Chiudi login">
            <i className="fas fa-times"></i>
          </button>

          {/* ── FORGOT PASSWORD ── */}
          {forgotStep !== null ? (
            <>
              <div className="auth-panel-head">
                <div>
                  <div className="auth-panel-title">
                    {forgotStep === 'done' ? 'Password aggiornata' : 'Reset password'}
                  </div>
                  <div className="auth-panel-sub">
                    {forgotStep === 'email' && 'Inserisci la tua email per ricevere il codice.'}
                    {forgotStep === 'code'  && 'Inserisci il codice ricevuto via email.'}
                    {forgotStep === 'done'  && 'Accedi con la tua nuova password.'}
                  </div>
                </div>
                <div className="auth-panel-chip">
                  <span className="roomie-chip roomie-chip-sm" aria-hidden="true"></span>
                </div>
              </div>

              {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}

              {forgotStep === 'email' && (
                <form className="auth-form active" onSubmit={handleForgotSendCode}>
                  <div className="form-group mb-3">
                    <label className="form-label">EMAIL</label>
                    <input ref={forgotEmailRef} className="form-input" autoComplete="email" type="email" placeholder="nome@email.com" />
                  </div>
                  <button className="btn-neon btn-neon-submit w-full" type="submit" disabled={busy}>
                    {busy ? 'Invio...' : 'INVIA CODICE'}
                  </button>
                  <div className="auth-footnote">
                    <button type="button" className="auth-link" onClick={exitForgot}>← Torna al login</button>
                  </div>
                </form>
              )}

              {forgotStep === 'code' && (
                <form className="auth-form active" onSubmit={handleForgotConfirm}>
                  <div className="form-group mb-3">
                    <label className="form-label">CODICE RICEVUTO VIA EMAIL</label>
                    <input ref={forgotCodeRef} className="form-input" autoComplete="one-time-code" placeholder="es. 123456" inputMode="numeric" />
                  </div>
                  <div className="form-group mb-3">
                    <label className="form-label">NUOVA PASSWORD</label>
                    <div className="password-field">
                      <input ref={newPasswordRef} className="form-input" autoComplete="new-password" type={showNewPassword ? 'text' : 'password'} placeholder="Minimo 8 caratteri" />
                      <button type="button" className="password-toggle" onClick={() => setShowNewPassword(v => !v)}>
                        <i className={`fas ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  </div>
                  <button className="btn-neon btn-neon-submit w-full" type="submit" disabled={busy}>
                    {busy ? 'Salvataggio...' : 'AGGIORNA PASSWORD'}
                  </button>
                  <div className="auth-footnote">
                    <button type="button" className="auth-link" onClick={exitForgot}>← Torna al login</button>
                  </div>
                </form>
              )}

              {forgotStep === 'done' && (
                <div className="auth-form active">
                  <button className="btn-neon btn-neon-submit w-full" type="button" onClick={exitForgot}>VAI AL LOGIN</button>
                </div>
              )}
            </>

          ) : verifyingEmail ? (
            /* ── EMAIL VERIFICATION (post-registrazione) ── */
            <>
              <div className="auth-panel-head">
                <div>
                  <div className="auth-panel-title">Verifica email</div>
                  <div className="auth-panel-sub">Abbiamo inviato un codice a 6 cifre alla tua email. Inseriscilo qui sotto.</div>
                </div>
                <div className="auth-panel-chip">
                  <span className="roomie-chip roomie-chip-sm" aria-hidden="true"></span>
                </div>
              </div>

              {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}

              <form className="auth-form active" onSubmit={handleVerifyEmail}>
                <div className="form-group mb-3">
                  <label className="form-label">CODICE DI VERIFICA</label>
                  <input
                    ref={verifyCodeRef}
                    className="form-input"
                    autoComplete="one-time-code"
                    placeholder="es. 123456"
                    inputMode="numeric"
                    autoFocus
                  />
                </div>
                <button className="btn-neon btn-neon-submit w-full" type="submit" disabled={busy}>
                  {busy ? 'Verifica...' : 'VERIFICA E ACCEDI'}
                </button>
                <div className="auth-footnote">
                  <button type="button" className="auth-link" onClick={() => { setVerifyingEmail(false); setError('') }}>
                    ← Torna alla registrazione
                  </button>
                </div>
              </form>
            </>

          ) : (
            /* ── LOGIN / REGISTER ── */
            <>
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
                  onClick={() => { setAuthMode('login'); setError(''); setVerifyingEmail(false) }}
                >Login</button>
                <button
                  className={`auth-tab${authMode === 'register' ? ' active' : ''}`}
                  type="button"
                  onClick={() => { setAuthMode('register'); setError(''); setVerifyingEmail(false) }}
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
                    <label className="form-label">EMAIL</label>
                    <input ref={loginEmailRef} className="form-input" autoComplete="email" type="email" placeholder="nome@email.com" />
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
                      <button type="button" className="password-toggle" onClick={() => setShowLoginPassword(v => !v)}>
                        <i className={`fas ${showLoginPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  </div>
                  <div className="auth-check-row">
                    <label className="auth-check">
                      <input ref={loginRememberRef} type="checkbox" defaultChecked /> Resta collegato
                    </label>
                    <button type="button" className="auth-link" onClick={() => { setError(''); setForgotStep('email') }}>
                      Hai dimenticato la password?
                    </button>
                  </div>
                  <button className="btn-neon btn-neon-submit w-full" type="submit" disabled={busy}>
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
                    <input ref={regNameRef} className="form-input" autoComplete="name" placeholder="Es. Marco Bianchi" />
                  </div>
                  <div className="form-group mb-3">
                    <label className="form-label">USERNAME</label>
                    <input ref={regUsernameRef} className="form-input" autoComplete="username" placeholder="3-20 caratteri, es. marco_b" />
                  </div>
                  <div className="form-group mb-3">
                    <label className="form-label">EMAIL</label>
                    <input ref={regEmailRef} className="form-input" autoComplete="email" type="email" placeholder="nome@email.com" />
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
                      <button type="button" className="password-toggle" onClick={() => setShowRegisterPassword(v => !v)}>
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
                  <button className="btn-neon btn-neon-submit w-full" type="submit" disabled={busy}>
                    {busy ? 'Registrazione...' : 'CREA ACCOUNT'}
                  </button>
                  <div className="auth-footnote">Le chips di benvenuto vengono aggiunte subito al tuo profilo.</div>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
