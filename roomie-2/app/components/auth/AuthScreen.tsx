'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth, useClerk, useSessionList } from '@clerk/nextjs'
import { useSignIn, useSignUp } from '@clerk/nextjs/legacy'
import { useApp } from '@/app/context/AppContext'
import { apiMe } from '@/lib/client-api'

type ForgotStep = 'email' | 'code' | 'done'
type SetActiveFn = (opts: {
  session: string
  redirectUrl?: string
  navigate?: (opts: { decorateUrl: (url: string) => string }) => Promise<unknown> | void
}) => Promise<void>
type PendingSignUp = {
  status?: string | null
  createdSessionId?: string | null
  emailAddress?: string | null
  missingFields?: string[]
  unverifiedFields?: string[]
  verifications?: {
    externalAccount?: {
      status?: string | null
      strategy?: string | null
      error?: {
        code?: string
        message?: string
        longMessage?: string
      } | null
    }
  }
  update?: (params: Record<string, unknown>) => Promise<PendingSignUp>
  prepareEmailAddressVerification?: (params: { strategy: 'email_code' }) => Promise<unknown>
  authenticateWithRedirect?: (params: Record<string, unknown>) => Promise<void>
}

export default function AuthScreen({ presentation = 'modal' }: { presentation?: 'modal' | 'page' }) {
  const { authOpen, authMode, setAuthMode, closeAuth, setUser, showPage, openLegalDoc } = useApp()
  const searchParams = useSearchParams()
  const isPage = presentation === 'page'
  const isActive = isPage || authOpen
  const { getToken, isLoaded: authLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const sessionList = useSessionList() as {
    isLoaded?: boolean
    sessions?: Array<{ id: string }>
    setActive?: (opts: { session: string }) => Promise<void>
  }
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

  // Register refs
  const regNameRef       = useRef<HTMLInputElement>(null)
  const regUsernameRef   = useRef<HTMLInputElement>(null)
  const regEmailRef      = useRef<HTMLInputElement>(null)
  const regPasswordRef   = useRef<HTMLInputElement>(null)
  const acceptTermsRef   = useRef<HTMLInputElement>(null)
  const acceptPrivacyRef = useRef<HTMLInputElement>(null)
  const verifyCodeRef    = useRef<HTMLInputElement>(null)

  // Forgot password refs
  const forgotEmailRef = useRef<HTMLInputElement>(null)
  const forgotCodeRef  = useRef<HTMLInputElement>(null)
  const newPasswordRef = useRef<HTMLInputElement>(null)
  const syncingSessionRef = useRef(false)

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

  function isSessionExistsError(err: unknown): boolean {
    const e = err as { errors?: Array<{ code?: string; message?: string }>; message?: string }
    const first = e?.errors?.[0]
    const text = `${first?.code || ''} ${first?.message || ''} ${e?.message || ''}`.toLowerCase()
    return text.includes('session_exists') || text.includes('session already exists')
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

  const completeLocalSession = async () => {
    const token = await getToken().catch(() => null)
    const user = await fetchUser(token)
    if (user) {
      setUser(user)
      closeAuth()
      goAfterAuth()
      return true
    }
    return false
  }

  const authUrl = (path: string) => {
    if (typeof window === 'undefined') return path
    return new URL(path, window.location.origin).toString()
  }

  const nextPath = () => {
    const next = searchParams.get('next')
    if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard'
    return next
  }

  const goAfterAuth = () => {
    const redirectTo = nextPath()
    if (redirectTo === '/dashboard') showPage('dashboard')
    else window.location.href = redirectTo
  }

  const activateAndRedirect = async (sessionId: string, setActiveFn: SetActiveFn | undefined) => {
    const redirectTo = nextPath()
    if (!setActiveFn) {
      window.location.href = redirectTo
      return
    }

    await setActiveFn({
      session: sessionId,
      navigate: ({ decorateUrl }) => {
        window.location.href = decorateUrl(redirectTo)
      },
    })
  }

  const registrationMetadata = () => {
    const name = regNameRef.current?.value.trim() ?? ''
    const username = regUsernameRef.current?.value.trim() ?? ''
    return {
      roomieUsername: username || undefined,
      roomieDisplayName: name || undefined,
      acceptedTerms: true,
      acceptedPrivacy: true,
    }
  }

  const usernameFromEmail = (email?: string | null) => {
    const seed = (email || 'roomie_user').split('@')[0] || 'roomie_user'
    const cleaned = seed.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '').slice(0, 20)
    return cleaned.length >= 3 ? cleaned : `roomie_${cleaned || 'user'}`
  }

  const recoverPendingSignUp = async () => {
    const pending = signUp as unknown as PendingSignUp | null
    if (!pending || pending.status !== 'missing_requirements') return false

    setBusy(true)
    setError('')
    try {
      let next = pending
      const externalError = next.verifications?.externalAccount?.error
      if (externalError) {
        console.error('[Clerk Google OAuth error]', externalError)
        if (externalError.code === 'oauth_token_exchange_error') {
          setError("Google non e' configurato correttamente in Clerk: il client secret OAuth non e' valido.")
        } else {
          setError(`Google non ha completato l'accesso: ${externalError.message || externalError.code || 'errore OAuth'}.`)
        }
        return false
      }

      const missing = new Set(next.missingFields || [])
      const patch: Record<string, unknown> = {}

      if (missing.has('legal_accepted') || missing.has('legalAccepted')) {
        patch.legalAccepted = true
      }
      if (missing.has('username')) {
        patch.username = usernameFromEmail(next.emailAddress)
      }
      if (Object.keys(patch).length && next.update) {
        next = await next.update({
          ...patch,
          unsafeMetadata: registrationMetadata(),
        })
      }

      if (next.status === 'complete' && next.createdSessionId) {
        await activateAndRedirect(next.createdSessionId, setActiveSignUp)
        return true
      }

      if (next.unverifiedFields?.includes('email_address')) {
        await next.prepareEmailAddressVerification?.({ strategy: 'email_code' })
        setVerifyingEmail(true)
        return true
      }

      setError(`Registrazione Google incompleta: ${next.missingFields?.join(', ') || 'requisiti mancanti'}.`)
      return false
    } catch (err) {
      setError(clerkErrMsg(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleSessionExists = async (): Promise<boolean> => {
    if (syncingSessionRef.current) return false
    syncingSessionRef.current = true
    setBusy(true)
    setError('')
    try {
      if (!isSignedIn && sessionList.isLoaded && sessionList.sessions?.length && sessionList.setActive) {
        await sessionList.setActive({ session: sessionList.sessions[0].id })
        await new Promise(r => setTimeout(r, 250))
      }
      const token = await getToken().catch(() => null)
      const user = await fetchUser(token)
      if (user) { setUser(user); closeAuth(); goAfterAuth(); return true }
      await signOut().catch(() => {})
      setError('Sessione precedente resettata. Riprovo il login...')
      return false
    } finally {
      syncingSessionRef.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!isActive || !authLoaded || !isSignedIn) return
    void handleSessionExists()
    // handleSessionExists closes over transient Clerk/session objects; this effect is keyed to auth state transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, authLoaded, isSignedIn, sessionList.isLoaded])

  useEffect(() => {
    if (!isActive || authMode !== 'register' || !signUpLoaded) return
    void recoverPendingSignUp()
    // recoverPendingSignUp intentionally runs only when Clerk exposes/changes pending sign-up status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, authMode, signUpLoaded, signUp?.status])

  useEffect(() => {
    document.body.classList.toggle('auth-modal-open', !isPage && authOpen)
    document.body.classList.toggle('auth-page-open', isPage)
    return () => {
      document.body.classList.remove('auth-modal-open')
      document.body.classList.remove('auth-page-open')
    }
  }, [authOpen, isPage])

  // ── LOGIN ───────────────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signInLoaded || !signIn) return
    setError('')
    if (authLoaded && isSignedIn) {
      await handleSessionExists()
      return
    }
    setBusy(true)
    const identifier = loginEmailRef.current?.value.trim() ?? ''
    const password   = loginPasswordRef.current?.value ?? ''
    try {
      const result = await signIn.create({ identifier, password })
      if (result.status === 'complete') {
        await activateAndRedirect(result.createdSessionId!, setActiveSignIn)
      } else {
        setError('Verifica la tua email prima di accedere.')
      }
    } catch (err) {
      if (isSessionExistsError(err)) {
        const recovered = await handleSessionExists()
        if (recovered) return
        try {
          const retry = await signIn.create({ identifier, password })
          if (retry.status === 'complete') {
            await activateAndRedirect(retry.createdSessionId!, setActiveSignIn)
          } else {
            setError('Verifica la tua email prima di accedere.')
          }
        } catch (retryErr) {
          setError(clerkErrMsg(retryErr))
        }
        return
      }
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
    if (authLoaded && isSignedIn) {
      await handleSessionExists()
      return
    }
    if (!acceptTermsRef.current?.checked || !acceptPrivacyRef.current?.checked) {
      setError(errMsg.TERMS_REQUIRED)
      return
    }
    setBusy(true)
    const name     = regNameRef.current?.value.trim() ?? ''
    const email    = regEmailRef.current?.value.trim() ?? ''
    const password = regPasswordRef.current?.value ?? ''
    try {
      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName: name || undefined,
        legalAccepted: true,
        unsafeMetadata: registrationMetadata(),
      })
      if (result.status === 'complete') {
        await activateAndRedirect(result.createdSessionId!, setActiveSignUp)
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
      if (isSessionExistsError(err)) { await handleSessionExists(); return }
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
        await activateAndRedirect(result.createdSessionId!, setActiveSignUp)
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
    setError('')
    setBusy(true)
    if (authLoaded && isSignedIn) {
      const completed = await completeLocalSession()
      if (!completed) await handleSessionExists()
      setBusy(false)
      return
    }

    if (authMode === 'register') {
      if (!signUpLoaded || !signUp) { window.location.href = '/sign-up'; return }
      try {
        const oauthSignUp = signUp as unknown as PendingSignUp
        await oauthSignUp.authenticateWithRedirect?.({
          strategy: 'oauth_google',
          redirectUrl: authUrl('/sso-callback'),
          redirectUrlComplete: authUrl('/dashboard'),
          continueSignIn: true,
          continueSignUp: true,
          legalAccepted: true,
          unsafeMetadata: registrationMetadata(),
        })
      } catch (err) {
        setError(clerkErrMsg(err))
        setBusy(false)
      }
      return
    }

    if (!signInLoaded || !signIn) { window.location.href = '/sign-in'; return }
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: authUrl('/sso-callback'),
        redirectUrlComplete: authUrl('/dashboard'),
      })
    } catch (err) {
      setError(clerkErrMsg(err))
      setBusy(false)
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
        await activateAndRedirect(result.createdSessionId!, setActiveSignIn)
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

  if (!isActive) return null

  return (
    <div className={`login-page${isPage ? ' is-route' : ''}`} id="auth-screen">
      <div className="login-shell container py-4">

        {/* ── AUTH LANDING (sinistra) ── */}
        <section className="auth-landing" aria-label="Roomie accesso">
          <div>
            <div className="auth-kicker"><i className="fas fa-lock-open"></i> Accesso Roomie · Torino</div>
            <div className="login-brand">ROOMIE</div>
            <div className="login-title">ENTRA, PRENOTA, GIOCA.</div>
            <div className="login-sub">Un solo accesso per prenotazioni, chips, inviti e codici room. Meno passaggi, piu&apos; controllo prima di arrivare.</div>
            <div className="auth-proof-grid">
              <div className="auth-proof"><strong>40 m2</strong><span>Room privata in Via Terni.</span></div>
              <div className="auth-proof"><strong>8 max</strong><span>Gruppo, inviti e guest pass.</span></div>
              <div className="auth-proof"><strong>Live</strong><span>Saldo, codici e slot in tempo reale.</span></div>
            </div>
          </div>
          <div className="auth-live-card">
            <div className="auth-live-row">
              <div>
                <div className="auth-live-title">Prima cosa utile dopo il login</div>
                <div className="auth-live-meta">Dashboard, chips e prenotazione nello stesso flusso</div>
              </div>
              <span className="auth-live-status">Ready</span>
            </div>
          </div>
        </section>

        {/* ── AUTH PANEL (destra) ── */}
        <section className="auth-panel" aria-label="Accesso account">
          {!isPage && (
            <button className="modal-close auth-modal-close" onClick={closeAuth} aria-label="Chiudi login">
              <i className="fas fa-times"></i>
            </button>
          )}

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

              {error && <div className="auth-error visible">{error}</div>}

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

              {error && <div className="auth-error visible">{error}</div>}

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
                  <div className="auth-panel-title">{authMode === 'login' ? 'Bentornato' : 'Crea il profilo'}</div>
                  <div className="auth-panel-sub">
                    {authMode === 'login'
                      ? 'Entra e vai subito a prenotazioni, chips e accesso room.'
                      : 'Ti servono solo email, password e consensi. Il profilo Roomie si prepara al primo accesso.'}
                  </div>
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

              {error && <div className="auth-error visible">{error}</div>}

              {/* LOGIN FORM */}
              {authMode === 'login' && (
                <form className="auth-form active" onSubmit={handleLogin}>
                  <div className="auth-benefit-strip">
                    <span><i className="fab fa-google"></i> Google o email</span>
                    <span><i className="fas fa-rotate-right"></i> Recupero sessione</span>
                  </div>
                  <div className="social-auth">
                    <button className="social-btn google" type="button" onClick={handleGoogle} disabled={busy}>
                      <i className="fab fa-google"></i> {busy ? 'Apertura Google...' : 'Continua con Google'}
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
                    <span className="auth-check">Sessione protetta da Clerk</span>
                    <button type="button" className="auth-link" onClick={() => { setError(''); setForgotStep('email') }}>
                      Hai dimenticato la password?
                    </button>
                  </div>
                  <button className="btn-neon btn-neon-submit w-full" type="submit" disabled={busy}>
                    {busy ? 'Accesso...' : 'ENTRA IN ROOMIE'}
                  </button>
                  <div className="auth-footnote">Se hai gia&apos; una sessione attiva, ti riportiamo direttamente in dashboard.</div>
                </form>
              )}

              {/* REGISTER FORM */}
              {authMode === 'register' && (
                <form className="auth-form active" onSubmit={handleRegister}>
                  <div className="auth-benefit-strip">
                    <span><i className="fas fa-id-card"></i> Profilo Roomie</span>
                    <span><i className="fas fa-calendar-check"></i> Prenotazione pronta</span>
                  </div>
                  <div className="social-auth">
                    <button className="social-btn google" type="button" onClick={handleGoogle} disabled={busy}>
                      <i className="fab fa-google"></i> {busy ? 'Apertura Google...' : 'Registrati con Google'}
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
                    Sessione account protetta da Clerk
                  </label>
                  <button className="btn-neon btn-neon-submit w-full" type="submit" disabled={busy}>
                    {busy ? 'Registrazione...' : 'CREA ACCOUNT'}
                  </button>
                  <div className="auth-footnote">Dopo la verifica email ti portiamo direttamente nella dashboard.</div>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
