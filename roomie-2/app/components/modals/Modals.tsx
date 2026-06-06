'use client'

import { useState, useRef, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { useApp } from '@/app/context/AppContext'
import { apiStripeTopup } from '@/lib/client-api'

// Type declaration for Mammoth.js global
declare global {
  interface Window {
    mammoth?: {
      convertToHtml: (options: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages: any[] }>
    }
  }
}

// ── LEGAL DOC CONFIG ──────────────────────────────────────────────────────────

const LEGAL = {
  terms: {
    title: 'Termini e Condizioni',
    meta: 'ROOMIE · Via Terni, Torino · Ultimo aggiornamento: 2024',
    file: '/legal/termini-condizioni-roomie.docx',
    fallback: `<p>La prenotazione della room implica accettazione delle presenti condizioni. Il servizio è disponibile 24h/24h previa prenotazione e pagamento anticipato in chips. Lo spazio è limitato a <strong>8 persone max</strong>. L'utente è responsabile di eventuali danni causati durante la sessione. Le telecamere sono attive per sicurezza. ROOMIE si riserva di sospendere account in caso di violazioni.</p>`,
  },
  privacy: {
    title: 'Privacy Policy',
    meta: 'ROOMIE · GDPR compliant · Ultimo aggiornamento: 2024',
    file: '/legal/privacy-policy-roomie.docx',
    fallback: `<p>I dati personali (nome, email, username) sono raccolti per erogare il servizio di prenotazione. Non vengono ceduti a terzi né usati per profilazione pubblicitaria. I dati di accesso fisico (log NFC, orari) sono conservati per 30 giorni a fini di sicurezza. Puoi richiedere la cancellazione del tuo account scrivendo a privacy@roomie.it.</p>`,
  },
  cookie: {
    title: 'Cookie Policy',
    meta: 'ROOMIE · Ultimo aggiornamento: 2024',
    file: '/legal/cookie-policy-roomie.docx',
    fallback: `<p>ROOMIE usa solo cookie tecnici essenziali per autenticazione, sicurezza e continuita' della sessione. L'accesso account e' gestito da Clerk; il cookie legacy <code>roomie.auth</code> puo' essere rimosso al logout se ancora presente da versioni precedenti. Nessun cookie di tracciamento o analisi di terze parti.</p>`,
  },
}

// ── MODAL WRAPPER ─────────────────────────────────────────────────────────────

function ModalOverlay({ open, onClose, maxWidth = 380, children }: {
  open: boolean; onClose: () => void; maxWidth?: number | string; children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth }}>
        {children}
      </div>
    </div>
  )
}

function ModalClose({ onClose }: { onClose: () => void }) {
  return (
    <button className="modal-close" onClick={onClose} aria-label="Chiudi">
      <i className="fas fa-times"></i>
    </button>
  )
}

// ── NFC MODAL ─────────────────────────────────────────────────────────────────

function NfcModal() {
  const { modalNfc, closeModal, showToast } = useApp()
  const [state, setState] = useState<'idle' | 'scanning' | 'ok' | 'error'>('idle')

  const simulate = () => {
    setState('scanning')
    setTimeout(() => {
      // In prod this calls real NFC read. For now simulate success.
      setState('ok')
      showToast({ title: 'Accesso NFC confermato', type: 'ok' })
      setTimeout(() => { closeModal('nfc'); setState('idle') }, 1200)
    }, 1800)
  }

  const close = () => { closeModal('nfc'); setState('idle') }

  return (
    <ModalOverlay open={modalNfc} onClose={close}>
      <ModalClose onClose={close} />
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div className="roomie-chip roomie-chip-lg" style={{ margin: '0 auto 16px' }} aria-label="ROOMIE Chip NFC"></div>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: '1.6rem', color: '#fff', marginBottom: '8px' }}>
          ROOMIE CHIP NFC
        </div>
        <div style={{ fontSize: '.85rem', color: 'var(--muted)', lineHeight: '1.55', marginBottom: '20px' }}>
          Avvicina la chip al lettore sulla porta. Funziona solo nella fascia oraria della tua prenotazione.
        </div>
        {state === 'scanning' && (
          <div style={{ color: 'var(--neon)', fontSize: '.85rem', fontWeight: 700, marginBottom: '12px', letterSpacing: '.1em' }}>
            <i className="fas fa-circle-notch fa-spin" style={{ marginRight: 8 }}></i> LETTURA IN CORSO…
          </div>
        )}
        {state === 'ok' && (
          <div style={{ color: 'var(--neon)', fontSize: '.85rem', fontWeight: 700, marginBottom: '12px' }}>
            <i className="fas fa-check-circle" style={{ marginRight: 8 }}></i> ACCESSO CONFERMATO
          </div>
        )}
        <button
          className="btn-neon w-full"
          style={{ justifyContent: 'center', padding: '14px' }}
          onClick={simulate}
          disabled={state === 'scanning' || state === 'ok'}
        >
          <i className="fas fa-microchip"></i> AVVICINA CHIP AL LETTORE
        </button>
      </div>
    </ModalOverlay>
  )
}

// ── CODE UNLOCK MODAL ─────────────────────────────────────────────────────────

function CodeUnlockModal() {
  const { modalCodeUnlock, closeModal, config, showToast } = useApp()
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]
  const [error, setError] = useState('')

  const close = () => { closeModal('codeUnlock'); setError(''); refs.forEach(r => { if (r.current) r.current.value = '' }) }

  const moveNext = (idx: number) => {
    if (idx < 3) refs[idx + 1].current?.focus()
  }

  const verify = () => {
    const code = refs.map(r => r.current?.value || '').join('')
    if (config.lockboxCode && code === config.lockboxCode) {
      showToast({ title: 'Codice corretto — porta aperta', type: 'ok' })
      close()
    } else {
      setError('Codice errato. Riprova.')
      refs.forEach(r => { if (r.current) r.current.value = '' })
      refs[0].current?.focus()
    }
  }

  return (
    <ModalOverlay open={modalCodeUnlock} onClose={close}>
      <ModalClose onClose={close} />
      <div className="modal-title">CODICE PORTA</div>
      <div className="modal-sub">Inserisci il codice numerico per sbloccare la porta</div>
      <div style={{ background: 'var(--dark3)', borderRadius: '10px', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
        <div style={{ fontSize: '.75rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>INSERISCI CODICE PORTA</div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', maxWidth: '280px', margin: '0 auto' }}>
          {refs.map((ref, i) => (
            <input
              key={i}
              ref={ref}
              type="text"
              className="code-digit"
              maxLength={1}
              inputMode="numeric"
              onInput={() => moveNext(i)}
              onKeyDown={e => { if (e.key === 'Enter') verify() }}
            />
          ))}
        </div>
        {error && <div style={{ color: 'var(--orange)', fontSize: '.8rem', marginTop: '10px' }}>{error}</div>}
      </div>
      <button className="btn-neon w-full" style={{ justifyContent: 'center', padding: '14px' }} onClick={verify}>
        <i className="fas fa-unlock"></i> SBLOCCA PORTA
      </button>
    </ModalOverlay>
  )
}

// ── TOKEN BUY MODAL ───────────────────────────────────────────────────────────

function TokenBuyModal() {
  const { modalTokenBuy, closeModal, showToast } = useApp()
  const [busy, setBusy] = useState(false)

  const close = () => closeModal('tokenBuy')

  const pay = async () => {
    setBusy(true)
    const { data, error } = await apiStripeTopup(modalTokenBuy.amount)
    setBusy(false)
    if (error || !data?.url) {
      showToast({ title: 'Errore pagamento. Riprova.', type: 'warn' })
      return
    }
    window.location.href = data.url
  }

  return (
    <ModalOverlay open={modalTokenBuy.open} onClose={close}>
      <ModalClose onClose={close} />
      <div className="modal-title">RICARICA CHIPS</div>
      <div className="modal-sub">Verrai reindirizzato a Stripe per il pagamento sicuro.</div>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: '2.5rem', color: 'var(--neon)', textAlign: 'center', margin: '16px 0' }}>
        {modalTokenBuy.amount} chips
      </div>
      <button
        className="btn-neon w-full"
        style={{ justifyContent: 'center', padding: '14px' }}
        onClick={pay}
        disabled={busy}
      >
        {busy ? <><i className="fas fa-circle-notch fa-spin"></i> …</> : 'PAGA CON STRIPE'}
      </button>
    </ModalOverlay>
  )
}

// ── LEGAL DOC MODAL ───────────────────────────────────────────────────────────

function LegalDocModal() {
  const { modalLegalDoc, closeModal } = useApp()
  const close = () => closeModal('legalDoc')
  const doc = modalLegalDoc.type ? LEGAL[modalLegalDoc.type] : null
  
  const [docHtml, setDocHtml] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Load and convert DOCX to HTML using Mammoth
  useEffect(() => {
    if (!modalLegalDoc.open || !doc) {
      setDocHtml('')
      setError(false)
      return
    }

    const loadDoc = async () => {
      setLoading(true)
      setError(false)
      try {
        // Wait for Mammoth to be available (loaded via script tag in layout.tsx)
        let attempts = 0
        while (!window.mammoth && attempts < 20) {
          await new Promise(r => setTimeout(r, 100))
          attempts++
        }

        if (!window.mammoth) {
          console.warn('Mammoth.js not loaded, using fallback')
          setDocHtml(DOMPurify.sanitize(doc.fallback))
          setLoading(false)
          return
        }

        // Fetch DOCX file as ArrayBuffer
        const response = await fetch(doc.file)
        if (!response.ok) throw new Error('Failed to load DOCX')
        const arrayBuffer = await response.arrayBuffer()

        // Convert DOCX to HTML using Mammoth
        const result = await window.mammoth.convertToHtml({ arrayBuffer })
        
        // Apply styling to the converted HTML for better readability in modal
        const styledHtml = `
          <div style="font-family: 'Barlow', sans-serif; line-height: 1.8; color: var(--text);">
            ${result.value}
          </div>
        `
        setDocHtml(DOMPurify.sanitize(styledHtml))
      } catch (err) {
        console.error('Error loading DOCX:', err)
        setError(true)
        setDocHtml(DOMPurify.sanitize(doc.fallback))
      } finally {
        setLoading(false)
      }
    }

    loadDoc()
  }, [modalLegalDoc.open, doc])

  return (
    <ModalOverlay open={modalLegalDoc.open} onClose={close} maxWidth="var(--roomie-shell-max)">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexShrink: 0 }}>
        <div>
          <div className="modal-title">{doc?.title ?? ''}</div>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{doc?.meta ?? ''}</div>
        </div>
        <ModalClose onClose={close} />
      </div>
      
      {/* Loading state */}
      {loading && (
        <div style={{ overflowY: 'auto', maxHeight: '55vh', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', minHeight: '200px' }}>
          <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
            <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }}></i>
            Caricamento documento…
          </div>
        </div>
      )}
      
      {/* Document content with scroll */}
      {!loading && (
        <div style={{ 
          overflowY: 'auto', 
          maxHeight: '55vh', 
          fontSize: '.85rem', 
          lineHeight: '1.7', 
          color: 'var(--text)', 
          marginBottom: '16px',
          padding: '12px 8px',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          backgroundColor: 'rgba(255,255,255,.02)'
        }}>
          {docHtml ? (
            <div dangerouslySetInnerHTML={{ __html: docHtml }} style={{ wordBreak: 'break-word' }} />
          ) : (
            <div style={{ color: 'var(--muted)' }}>
              {error ? '❌ Errore nel caricamento del documento' : 'Nessun contenuto disponibile'}
            </div>
          )}
        </div>
      )}
      
      {/* Download button */}
      {doc && (
        <a
          href={doc.file}
          download
          className="btn-outline-neon w-full"
          style={{ display: 'flex', justifyContent: 'center', padding: '12px', textDecoration: 'none' }}
        >
          <i className="fas fa-download" style={{ marginRight: 8 }}></i> SCARICA DOCUMENTO COMPLETO
        </a>
      )}
    </ModalOverlay>
  )
}

// ── INVITE MODAL ──────────────────────────────────────────────────────────────

function InviteModal() {
  const { modalInvite, closeModal, showToast, addInvitedFriends } = useApp()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; username: string; name: string; meta?: string; avatar?: string; source?: string }[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = () => { closeModal('invite'); setQuery(''); setResults([]); setSelected([]); setSearchError('') }

  const search = (q: string) => {
    setQuery(q)
    setSearchError('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/friends/platform?q=${encodeURIComponent(q.trim())}`)
        const data = await res.json()
        if (!res.ok) {
          setResults([])
          setSearchError(data.error || 'CLERK_USERS_API_FAILED')
          return
        }
        setResults((data.friends ?? []).slice(0, 6))
      } catch {
        setResults([])
        setSearchError('CLERK_USERS_API_FAILED')
      } finally { setLoading(false) }
    }, 300)
  }

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const generateLink = () => {
    const link = `${window.location.origin}/invite/${Math.random().toString(36).slice(2, 10)}`
    navigator.clipboard.writeText(link).then(() => showToast({ title: 'Link copiato!' }))
  }

  const confirmSelected = () => {
    const friends = results.filter(user => selected.includes(user.id))
    if (!friends.length) {
      showToast({ title: 'Seleziona almeno un account', type: 'warn' })
      return
    }
    addInvitedFriends(friends)
    showToast({
      title: 'Gruppo aggiornato',
      copy: 'Per avviare tutte le esperienze devono essere presenti tutti. Puoi comunque entrare: luci/esperienze restano in attesa, almeno stai al caldo o al fresco.',
      type: 'ok',
    })
    close()
  }

  return (
    <ModalOverlay open={modalInvite} onClose={close} maxWidth={400}>
      <ModalClose onClose={close} />
      <div className="modal-title">AGGIUNGI AL GRUPPO</div>
      <div className="modal-sub">Cerca un account Roomie o genera un link invito per chi non ha l&apos;app.</div>
      <div className="form-group mb-3" style={{ marginTop: '16px' }}>
        <label className="form-label">CERCA ACCOUNT ROOMIE</label>
        <input
          className="form-input"
          placeholder="Username o nome"
          value={query}
          onChange={e => search(e.target.value)}
        />
      </div>
      {loading && <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '8px' }}>Ricerca…</div>}
      {searchError && <div className="auth-error visible">Clerk Users API non ha risposto: {searchError}</div>}
      {results.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {results.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => toggle(u.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                background: selected.includes(u.id) ? 'rgba(200,255,0,.12)' : 'var(--dark3)',
                border: `1px solid ${selected.includes(u.id) ? 'var(--neon)' : 'var(--border)'}`,
                borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer',
                color: 'var(--text)', textAlign: 'left',
              }}
            >
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, display: 'block', fontSize: '.85rem' }}>{u.name}</span>
                <span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>{u.meta || `@${u.username}`}</span>
              </span>
              {selected.includes(u.id) && <i className="fas fa-check" style={{ color: 'var(--neon)' }}></i>}
            </button>
          ))}
        </div>
      )}
      <button
        className="btn-neon w-full"
        style={{ justifyContent: 'center', marginBottom: '12px' }}
        onClick={confirmSelected}
        disabled={selected.length === 0}
      >
        AGGIUNGI {selected.length > 0 ? selected.length : ''} AL GRUPPO
      </button>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
        <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '8px' }}>Oppure genera link invito per guest</div>
        <button className="btn-neon w-full" style={{ justifyContent: 'center' }} onClick={generateLink}>
          <i className="fas fa-link"></i> GENERA LINK INVITO
        </button>
      </div>
    </ModalOverlay>
  )
}

// ── LEGAL FOOTER ──────────────────────────────────────────────────────────────

function LegalFooter() {
  const { openLegalDoc } = useApp()
  return (
    <footer className="legal-footer" aria-label="Documenti legali Roomie">
      <span>ROOMIE</span>
      <button type="button" onClick={() => openLegalDoc('terms')}>Termini e Condizioni</button>
      <button type="button" onClick={() => openLegalDoc('privacy')}>Privacy Policy</button>
      <button type="button" onClick={() => openLegalDoc('cookie')}>Cookie Policy</button>
      <span>Via Terni · Torino</span>
    </footer>
  )
}

// ── EXPORT ────────────────────────────────────────────────────────────────────

export default function Modals() {
  return (
    <>
      <NfcModal />
      <CodeUnlockModal />
      <TokenBuyModal />
      <LegalDocModal />
      <InviteModal />
      {/* Legacy toast fallback (React Toast is primary) */}
      <div id="toast" className="toast-pop" aria-live="polite" style={{ display: 'none' }}></div>
      <LegalFooter />
    </>
  )
}
