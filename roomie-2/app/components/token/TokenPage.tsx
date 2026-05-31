'use client'

import { useState } from 'react'
import { useApp } from '@/app/context/AppContext'
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
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>

        <span className="section-label">Il tuo saldo</span>
        <h2 style={{ fontFamily: '\'Barlow Condensed\',sans-serif', fontWeight: 900, fontSize: '3rem', color: '#fff', lineHeight: '1', marginBottom: '20px' }}>
          ROOMIE CHIPS
        </h2>

        <div className="token-chip mb-20">
          <div className="flex items-center justify-between flex-wrap gap-12">
            <div>
              <div className="token-symbol">{user?.chips ?? 0} chips</div>
              <div className="token-name">ROOMIE CHIPS</div>
              <div className="token-rate">1 chip = <strong>€1</strong> · Come una prepagata, solo per Roomie</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="roomie-chip roomie-chip-lg" style={{ '--chip-size': '96px', margin: '0 0 10px auto' } as React.CSSProperties}></div>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '4px' }}>Il tuo saldo</div>
              <div style={{ fontFamily: '\'Barlow Condensed\',sans-serif', fontWeight: 900, fontSize: '3.5rem', color: 'var(--neon)', lineHeight: '1' }}>
                €{user?.chips ?? 0}
              </div>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>disponibili ora</div>
            </div>
          </div>
        </div>

        {/* Ricarica */}
        <div className="chip" style={{ padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff', marginBottom: '4px' }}>Ricarica chips</div>
          <div style={{ fontSize: '.83rem', color: 'var(--muted)', marginBottom: '16px' }}>Usa carta, PayPal o Satispay. Le chips non scadono.</div>
          <div className="buy-amounts">
            {AMOUNTS.map(a => (
              <div
                key={a.chips}
                className={`buy-amt${selected === a.chips && !custom ? ' active' : ''}`}
                onClick={() => { setSelected(a.chips); setCustom('') }}
              >
                {a.chips} chips<br />
                <small style={{ color: 'var(--muted)' }}>{a.eur} {a.bonus}</small>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label className="form-label">OPPURE IMPORTO CUSTOM</label>
            <input
              type="number"
              className="form-input"
              placeholder="es. 35"
              value={custom}
              onChange={e => setCustom(e.target.value)}
            />
          </div>
          <button
            className="btn-neon w-full"
            style={{ justifyContent: 'center', padding: '14px' }}
            onClick={handleTopup}
            disabled={busy}
          >
            {busy ? 'Apertura pagamento...' : `RICARICA ${amount} chips`}
          </button>
        </div>

        {/* A cosa servono */}
        <div className="chip" style={{ padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '14px' }}>A cosa servono le chips</div>
          <div className="flex flex-col gap-12">
            {[
              { icon: '🏠', color: 'rgba(200,255,0,.1)', title: 'Prenotare la room', sub: '12 chips/ora · 60 chips giornata intera' },
              { icon: 'fa-futbol', fa: true, color: 'rgba(0,255,209,.1)', title: 'DAZN per la partita', sub: '5 chips/evento · solo durante la tua sessione' },
              { icon: '🛒', color: 'rgba(255,90,31,.1)', title: 'Snack & bevande', sub: 'Ordinabili in-app con consegna in room' },
              { icon: 'fa-pizza-slice', fa: true, color: 'rgba(200,255,0,.1)', title: 'Ristoranti partner', sub: 'Mostra il codice e ottieni 10% di sconto' },
              { icon: '✨', color: 'rgba(150,100,255,.1)', title: 'Allestimenti esclusivi', sub: 'Setup gaming pro, luce rossa, mood horror ecc.' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-12">
                <div style={{ width: '36px', height: '36px', background: item.color, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem' }}>
                  {item.fa ? <i className={`fas ${item.icon}`}></i> : item.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--text)' }}>{item.title}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Partner */}
        <div style={{ fontWeight: 700, fontSize: '.85rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>RISTORANTI PARTNER · 10% con codice ROOMIE</div>
        <div className="flex flex-col gap-8">
          {[
            { logo: 'fa-pizza-slice', logoColor: '#E50914', logoBg: 'rgba(229,9,20,.15)', name: 'Pizzeria Da Marco', desc: '50m a piedi · Consegna in room disponibile' },
            { logo: '🍔', logoColor: 'orange', logoBg: 'rgba(255,165,0,.15)', name: 'Burger Republic', desc: '3 minuti a piedi · Open fino alle 2' },
            { logo: '🌮', logoColor: '#00c864', logoBg: 'rgba(0,200,100,.15)', name: 'Taco Torino', desc: 'Delivery · Consegna media 20min' },
          ].map((p, i) => (
            <div key={i} className="partner-chip">
              <div className="partner-logo" style={{ background: p.logoBg, color: p.logoColor }}>
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
