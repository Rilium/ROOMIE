'use client'

import { useMemo, useRef, useState } from 'react'
import { apiAcceptLegal, apiMockVerifyDocument } from '@/lib/client-api'
import { useApp } from '@/app/context/AppContext'

type DocType = 'id_card' | 'driver_license'

function inferLast4(fileName: string) {
  const digits = fileName.replace(/\D/g, '')
  if (digits.length >= 2) return digits.slice(-4)
  return String(Math.floor(1000 + Math.random() * 9000))
}

export default function OnboardingGate() {
  const { user, setUser, logout, openLegalDoc } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [docType, setDocType] = useState<DocType>('id_card')
  const [docName, setDocName] = useState('')
  const [docLast4, setDocLast4] = useState('')
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'ready'>('idle')
  const [termsChecked, setTermsChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)

  const needsLegal = Boolean(user && (!user.termsAcceptedAt || !user.privacyAcceptedAt))
  const needsDocument = Boolean(user && (user.documentVerificationStatus || 'missing') === 'missing')
  const visible = Boolean(user && (needsLegal || needsDocument))

  const stepCopy = useMemo(() => {
    if (needsLegal) return {
      title: 'Completa il profilo Roomie',
      sub: 'Prima di entrare, accetta Termini e Privacy. Se non accetti, chiudiamo la sessione.',
    }
    return {
      title: 'Verifica documento',
      sub: 'Carica carta identita o patente. Per ora l OCR e mockato: non salviamo il file, salviamo solo stato e ultimi caratteri.',
    }
  }, [needsLegal])

  if (!visible || !user) return null

  const acceptLegal = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await apiAcceptLegal()
      if (res.data?.user) setUser(res.data.user)
      else setError(res.error || 'Impossibile salvare i consensi.')
    } finally {
      setBusy(false)
    }
  }

  const runMockOcr = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError('')
    setScanState('scanning')
    await new Promise(r => setTimeout(r, 900))
    setDocName(user.name || file.name.replace(/\.[^.]+$/, '') || 'Documento Roomie')
    setDocLast4(inferLast4(file.name))
    setScanState('ready')
    setBusy(false)
  }

  const verifyDocument = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await apiMockVerifyDocument({
        documentType: docType,
        documentLast4: docLast4,
        documentName: docName,
      })
      if (res.data?.user) setUser(res.data.user)
      else setError(res.error || 'Impossibile salvare la verifica documento.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboarding-gate" role="dialog" aria-modal="true" aria-label={stepCopy.title}>
      <section className="onboarding-card">
        <div className="onboarding-head">
          <div>
            <div className="auth-kicker"><i className="fas fa-id-card"></i> Onboarding Roomie</div>
            <div className="onboarding-title">{stepCopy.title}</div>
            <div className="onboarding-sub">{stepCopy.sub}</div>
          </div>
          <span className="roomie-chip" aria-hidden="true"></span>
        </div>

        {error && <div className="auth-error visible">{error}</div>}

        {needsLegal ? (
          <div className="onboarding-step">
            <div className="onboarding-checklist">
              <button type="button" className={`roomie-consent-check${termsChecked ? ' checked' : ''}`} onClick={() => setTermsChecked(v => !v)}>
                <span className="roomie-check-orb"><i className="fas fa-check"></i></span>
                <span>
                  <strong>Accetto Termini e Condizioni</strong>
                  <small>Ho letto le regole della room, accesso, danni e responsabilita.</small>
                </span>
              </button>
              <button type="button" className={`roomie-consent-check${privacyChecked ? ' checked' : ''}`} onClick={() => setPrivacyChecked(v => !v)}>
                <span className="roomie-check-orb"><i className="fas fa-check"></i></span>
                <span>
                  <strong>Accetto Privacy Policy</strong>
                  <small>Ho capito come usate dati account, sicurezza e verifica.</small>
                </span>
              </button>
            </div>
            <div className="onboarding-doc-links">
              <button type="button" onClick={() => openLegalDoc('terms')}>Leggi Termini</button>
              <button type="button" onClick={() => openLegalDoc('privacy')}>Leggi Privacy</button>
            </div>
            <button className="btn-neon btn btn-primary btn-neon-submit w-full" type="button" onClick={acceptLegal} disabled={busy || !termsChecked || !privacyChecked}>
              {busy ? 'Salvataggio...' : 'ACCETTO E CONTINUO'}
            </button>
            <button className="auth-link onboarding-cancel" type="button" onClick={logout} disabled={busy}>
              Non accetto, esci
            </button>
          </div>
        ) : (
          <div className="onboarding-step">
            <div className="document-type-row" role="radiogroup" aria-label="Tipo documento">
              <button type="button" className={docType === 'id_card' ? 'active' : ''} onClick={() => setDocType('id_card')}>
                <i className="fas fa-address-card"></i> Carta identita
              </button>
              <button type="button" className={docType === 'driver_license' ? 'active' : ''} onClick={() => setDocType('driver_license')}>
                <i className="fas fa-car"></i> Patente
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={e => void runMockOcr(e.target.files?.[0])}
            />
            <button className="document-upload" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
              <i className="fas fa-cloud-upload-alt"></i>
              <span>{scanState === 'scanning' ? 'OCR mock in corso...' : 'Carica immagine documento'}</span>
            </button>

            {scanState === 'ready' && (
              <div className="document-preview">
                <div>
                  <label className="form-label">NOME LETTO</label>
                  <input className="form-input" value={docName} onChange={e => setDocName(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">ULTIMI CARATTERI</label>
                  <input className="form-input" value={docLast4} onChange={e => setDocLast4(e.target.value)} maxLength={8} />
                </div>
              </div>
            )}

            <button className="btn-neon btn btn-primary btn-neon-submit w-full" type="button" onClick={verifyDocument} disabled={busy || scanState !== 'ready'}>
              {busy ? 'Verifica...' : 'CONFERMA DOCUMENTO'}
            </button>
            <div className="auth-footnote">Mock MVP: il file non viene salvato. La verifica reale andra collegata a un provider KYC.</div>
          </div>
        )}
      </section>
    </div>
  )
}
