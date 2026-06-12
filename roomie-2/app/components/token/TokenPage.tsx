'use client'

import { useState } from 'react'
import { useApp } from '@/app/context/AppContext'
import ChipAmount from '@/app/components/ui/ChipAmount'
import RoomieLogoText from '@/app/components/ui/RoomieLogoText'
import { apiStripeTopup } from '@/lib/client-api'

const AMOUNTS = [
  { chips: 20, eur: '€20', bonus: '' },
  { chips: 50, eur: '€50', bonus: '' },
  { chips: 100, eur: '€100', bonus: '🎁+5' },
  { chips: 200, eur: '€200', bonus: '🎁+20' },
]

export default function TokenPage() {
  const { user, showToast } = useApp()
  const [selected, setSelected] = useState(20)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)

  const amount = custom ? parseInt(custom) || 0 : selected

  const handleTopup = async () => {
    if (amount < 5) { showToast({ title: 'Importo minimo 5 chips', type: 'warn' }); return }
    setBusy(true)
    const { data, error } = await apiStripeTopup(amount, 'dashboard')
    setBusy(false)
    if (error) {
      const msg = error === 'STRIPE_NOT_CONFIGURED'
        ? 'Pagamenti non configurati in questa versione.'
        : 'Errore pagamento. Riprova.'
      showToast({ title: msg, type: 'warn' })
      return
    }
    if (data?.url) window.location.href = data.url
  }

  return (
    <div className="page active" id="page-token">
      <div className="roomie-shell">

        <span className="section-label">Il tuo saldo</span>
        <h2 className="token-title">
          <RoomieLogoText size="lg" /> CHIPS
        </h2>

        <div className="token-chip card mb-4">
          <div className="flex items-center justify-between flex-wrap gap-12">
            <div>
              <div className="token-symbol"><ChipAmount amount={user?.chips ?? 0} size="lg" tone="primary" /></div>
              <div className="token-name"><RoomieLogoText size="xs" /> CHIPS</div>
              <div className="token-rate">1 chip = <strong>€1</strong> · Come una prepagata, solo per Roomie</div>
            </div>
            <div className="token-balance-box">
              <div className="roomie-chip roomie-chip-lg token-balance-chip"></div>
              <div className="roomie-copy-muted mb-4">Il tuo saldo</div>
              <div className="token-balance-value">
                <ChipAmount amount={user?.chips ?? 0} size="md" tone="primary" showEuro />
              </div>
              <div className="roomie-copy-muted">disponibili ora</div>
            </div>
          </div>
        </div>

        {/* Ricarica */}
        <div className="chip roomie-card-pad-20 card">
          <div className="token-card-title">Ricarica chips</div>
          <div className="token-card-copy">Usa carta, PayPal o Satispay. Le chips non scadono.</div>
          <div className="buy-amounts">
            {AMOUNTS.map(a => (
              <button
                type="button"
                key={a.chips}
                className={`buy-amt btn${selected === a.chips && !custom ? ' active btn-primary' : ' btn-outline-light'}`}
                onClick={() => { setSelected(a.chips); setCustom('') }}
              >
                <ChipAmount amount={a.chips} size="sm" /><br />
                <small className="token-pack-note">{a.eur} {a.bonus}</small>
              </button>
            ))}
          </div>
          <div className="token-pack-actions">
            <label className="form-label">OPPURE IMPORTO CUSTOM</label>
            <input
              type="number"
              className="form-input form-control"
              placeholder="es. 35"
              value={custom}
              onChange={e => setCustom(e.target.value)}
            />
          </div>
          <button
            className="btn-neon btn btn-primary w-full roomie-btn-primary-action"
            onClick={handleTopup}
            disabled={busy}
          >
            {busy ? 'Apertura pagamento...' : <span className="chip-cta-label">RICARICA <ChipAmount amount={amount} size="xs" /></span>}
          </button>
        </div>

        {/* A cosa servono */}
        <div className="chip roomie-card-pad-20 card">
          <div className="token-section-title">A cosa servono le chips</div>
          <div className="flex flex-col gap-12">
            {[
              { icon: '🏠', tone: 'lime', title: 'Prenotare la room', price: <><ChipAmount amount={12} size="xs" />/ora · <ChipAmount amount={60} size="xs" /> giornata intera</> },
              { icon: 'fa-futbol', fa: true, tone: 'cyan', title: 'DAZN per la partita', price: <><ChipAmount amount={5} size="xs" />/evento · solo durante la tua sessione</> },
              { icon: '🛒', tone: 'orange', title: 'Snack & bevande', price: 'Ordinabili in-app con consegna in room' },
              { icon: 'fa-pizza-slice', fa: true, tone: 'lime', title: 'Ristoranti partner', price: 'Mostra il codice e ottieni 10% di sconto' },
              { icon: '✨', tone: 'purple', title: 'Allestimenti esclusivi', price: 'Setup gaming pro, luce rossa, mood horror ecc.' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-12">
                <div className={`token-use-icon ${item.tone}`}>
                  {item.fa ? <i className={`fas ${item.icon}`}></i> : item.icon}
                </div>
                <div>
                  <div className="token-use-title">{item.title}</div>
                  <div className="roomie-copy-muted-sm">{item.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Partner */}
        <div className="token-partner-heading">RISTORANTI PARTNER · 10% con codice <RoomieLogoText size="xs" /></div>
        <div className="flex flex-col gap-8">
          {[
            { logo: 'fa-pizza-slice', tone: 'red', name: 'Pizzeria Da Marco', desc: '50m a piedi · Consegna in room disponibile' },
            { logo: '🍔', tone: 'orange', name: 'Burger Republic', desc: '3 minuti a piedi · Open fino alle 2' },
            { logo: '🌮', tone: 'green', name: 'Taco Torino', desc: 'Delivery · Consegna media 20min' },
          ].map((p, i) => (
            <div key={i} className="partner-chip card">
              <div className={`partner-logo ${p.tone}`}>
                {p.logo.startsWith('fa-') ? <i className={`fas ${p.logo}`}></i> : p.logo}
              </div>
              <div className="partner-info">
                <div className="partner-name">{p.name}</div>
                <div className="partner-desc">{p.desc}</div>
              </div>
              <div className="partner-badge">-10%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
