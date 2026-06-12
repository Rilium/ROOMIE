'use client'

import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/app/context/AppContext'
import { apiStripeTopup } from '@/lib/client-api'
import SafeDocViewer from '@/app/components/ui/SafeDocViewer'
import ChipAmount from '@/app/components/ui/ChipAmount'
import RoomieLogoText from '@/app/components/ui/RoomieLogoText'

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
    document.body.classList.add('roomie-modal-open')
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.classList.remove('roomie-modal-open')
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-overlay modal show roomie-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box modal-dialog modal-dialog-centered" style={{ maxWidth }}>
        {children}
      </div>
    </div>
  )
}

function ModalClose({ onClose }: { onClose: () => void }) {
  return (
    <button className="modal-close btn btn-outline-light" onClick={onClose} aria-label="Chiudi">
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
      <div className="roomie-modal-body text-center">
        <div className="roomie-chip roomie-chip-lg roomie-modal-chip" aria-label="ROOMIE Chip NFC"></div>
        <div className="roomie-modal-title">
          <RoomieLogoText size="sm" /> CHIP NFC
        </div>
        <div className="roomie-modal-copy">
          Avvicina la chip al lettore sulla porta. Funziona solo nella fascia oraria della tua prenotazione.
        </div>
        {state === 'scanning' && (
          <div className="roomie-modal-status">
            <i className="fas fa-circle-notch fa-spin me-2"></i> LETTURA IN CORSO...
          </div>
        )}
        {state === 'ok' && (
          <div className="roomie-modal-status">
            <i className="fas fa-check-circle me-2"></i> ACCESSO CONFERMATO
          </div>
        )}
        <button
          className="btn-neon btn btn-primary w-full"
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
      <div className="roomie-code-panel">
        <div className="roomie-code-label">INSERISCI CODICE PORTA</div>
        <div className="roomie-code-grid">
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
        {error && <div className="roomie-code-error">{error}</div>}
      </div>
      <button className="btn-neon btn btn-primary w-full" onClick={verify}>
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
      <div className="roomie-modal-amount">
        <ChipAmount amount={modalTokenBuy.amount} size="lg" tone="primary" showEuro />
      </div>
      <button
        className="btn-neon btn btn-primary w-full"
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

  return (
    <ModalOverlay open={modalLegalDoc.open} onClose={close} maxWidth="var(--roomie-shell-max)">
      <div className="roomie-modal-head">
        <div>
          <div className="modal-title">{doc?.title ?? ''}</div>
          <div className="roomie-modal-meta">{doc?.meta ?? ''}</div>
        </div>
        <ModalClose onClose={close} />
      </div>
      
      {doc && (
        <SafeDocViewer
          active={modalLegalDoc.open}
          file={doc.file}
          fallback={doc.fallback}
          loadingLabel="Caricamento documento…"
          errorLabel="Errore nel caricamento del documento"
          wrapHtml={html => `
            <div class="roomie-legal-doc-content">
              ${html}
            </div>
          `}
          className="roomie-legal-doc-frame"
        />
      )}
      
      {/* Download button */}
      {doc && (
        <a
          href={doc.file}
          download
          className="btn-outline-neon btn btn-outline-light w-full"
        >
          <i className="fas fa-download me-2"></i> SCARICA DOCUMENTO COMPLETO
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
      <div className="form-group mb-3 mt-3">
        <label className="form-label">CERCA ACCOUNT <RoomieLogoText size="xs" /></label>
        <input
          className="form-input form-control"
          placeholder="Username o nome"
          value={query}
          onChange={e => search(e.target.value)}
        />
      </div>
      {loading && <div className="roomie-modal-meta mb-2">Ricerca...</div>}
      {searchError && <div className="auth-error visible">Clerk Users API non ha risposto: {searchError}</div>}
      {results.length > 0 && (
        <div className="roomie-invite-results">
          {results.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => toggle(u.id)}
              className={`roomie-invite-row btn ${selected.includes(u.id) ? 'active btn-primary' : 'btn-outline-light'}`}
            >
              <span className="roomie-invite-copy">
                <span className="roomie-invite-name">{u.name}</span>
                <span className="roomie-invite-meta">{u.meta || `@${u.username}`}</span>
              </span>
              {selected.includes(u.id) && <i className="fas fa-check"></i>}
            </button>
          ))}
        </div>
      )}
      <button
        className="btn-neon btn btn-primary w-full mb-3"
        onClick={confirmSelected}
        disabled={selected.length === 0}
      >
        AGGIUNGI {selected.length > 0 ? selected.length : ''} AL GRUPPO
      </button>
      <div className="roomie-modal-footer-split">
        <div className="roomie-modal-meta mb-2">Oppure genera link invito per guest</div>
        <button className="btn-neon btn btn-primary w-full" onClick={generateLink}>
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
      <span><RoomieLogoText size="xs" /></span>
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
      <div id="toast" className="toast-pop d-none" aria-live="polite"></div>
      <LegalFooter />
    </>
  )
}
