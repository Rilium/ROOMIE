'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/app/context/AppContext'
import { apiGetAddons, apiOrderAddons } from '@/lib/client-api'
import type { Addon } from '@/lib/types'

export default function ShopPage() {
  const { user, cart, addToCart, updateCartItem, removeCartItem, clearCart, showToast, showPage, activeSession } = useApp()
  const [addons, setAddons] = useState<Addon[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiGetAddons().then(({ data }) => {
      if (data?.addons) setAddons(data.addons)
    })
  }, [])

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const isLive = Boolean(activeSession)
  const balance = user?.chips ?? 0

  const handleCheckout = useCallback(async () => {
    if (!isLive) { showToast({ title: 'Attivo solo durante la sessione', type: 'warn' }); return }
    if (!activeSession?.booking?.id) { showToast({ title: 'Nessuna sessione attiva', type: 'warn' }); return }
    if (balance < cartTotal) { showToast({ title: 'Chips insufficienti', type: 'warn' }); showPage('token'); return }
    setBusy(true)
    const items = cart.filter(i => i.id).map(i => ({ id: i.id!, qty: i.qty }))
    const { error } = await apiOrderAddons({ bookingId: activeSession.booking.id, items })
    setBusy(false)
    if (error) { showToast({ title: error, type: 'warn' }); return }
    clearCart()
    showToast({ title: 'Ordine confermato! Attivazione in corso.' })
  }, [isLive, activeSession, balance, cartTotal, cart, clearCart, showToast, showPage])

  const featured = addons.filter(a => a.category === 'featured' && a.status === 'active')
  const modes = addons.filter(a => a.category === 'modes' && a.status === 'active')
  const snacks = addons.filter(a => a.category === 'snacks' && a.status === 'active')

  return (
    <div className="page active" id="page-shop">
      <div className="shop-inner">
        <div className="shop-hero">
          <span className="addon-badge">SHOP SESSIONE</span>
          <div className="shop-hero-title">POTENZIA<br />LA SESSIONE.</div>
          <div className="shop-hero-sub">Addon immediati, snack e setup extra. Paghi in chips, si attivano durante la sessione.</div>
        </div>

        {!isLive && (
          <div className="shop-locked-banner">
            <strong>Shop in anteprima.</strong> Gli acquisti si attivano solo quando la sessione è live.
          </div>
        )}

        {isLive && (
          <div className="shop-session-context" style={{ borderColor: 'rgba(200,255,0,.3)', background: 'rgba(200,255,0,.05)' }}>
            <div><strong>Sessione live</strong><span>Saldo: {balance} chips · Carrello: {cartTotal} chips</span></div>
          </div>
        )}

        {/* Bundles */}
        <div className="bundle-row">
          <div className="bundle-card">
            <div>
              <div className="bundle-kicker">MIGLIOR SCELTA</div>
              <div className="bundle-title">PARTITA + SNACK.</div>
              <div className="bundle-copy">DAZN Partita, soft drinks e Snack Box.</div>
            </div>
            <div className="bundle-footer">
              <div className="bundle-price">16 chips</div>
              <button className="bundle-btn" onClick={() => {
                addToCart({ name: 'DAZN Partita', price: 5, qty: 1 })
                addToCart({ name: 'Soft drinks ×6', price: 6, qty: 1 })
                addToCart({ name: 'Snack Box', price: 5, qty: 1 })
              }}>AGGIUNGI PACK</button>
            </div>
          </div>
          <div className="bundle-card secondary">
            <div>
              <div className="bundle-kicker">SETUP ROOM</div>
              <div className="bundle-title">GAMING BOOST.</div>
              <div className="bundle-copy">Gaming Pro + Neon Party.</div>
            </div>
            <div className="bundle-footer">
              <div className="bundle-price">12 chips</div>
              <button className="bundle-btn" onClick={() => {
                addToCart({ name: 'Gaming Pro Setup', price: 8, qty: 1 })
                addToCart({ name: 'Neon Party', price: 4, qty: 1 })
              }}>AGGIUNGI</button>
            </div>
          </div>
        </div>

        {/* Featured */}
        {featured.length > 0 && (
          <section className="shop-section">
            <div className="shop-section-head">
              <div className="shop-section-title">Streaming on-demand</div>
              <div className="shop-section-note">attivi in sessione</div>
            </div>
            <div className="addon-grid">
              {featured.map(a => (
                <AddonCard key={a.id} addon={a} onAdd={item => addToCart({ ...item, id: a.id })} />
              ))}
            </div>
          </section>
        )}

        {/* Modes */}
        {modes.length > 0 && (
          <section className="shop-section">
            <div className="shop-section-head">
              <div className="shop-section-title">Allestimenti esclusivi</div>
              <div className="shop-section-note">setup room</div>
            </div>
            <div className="addon-grid">
              {modes.map(a => (
                <AddonCard key={a.id} addon={a} onAdd={item => addToCart({ ...item, id: a.id })} />
              ))}
            </div>
          </section>
        )}

        {/* Snacks */}
        {snacks.length > 0 && (
          <section className="shop-section">
            <div className="shop-section-head">
              <div className="shop-section-title">Snack & bevande</div>
              <div className="shop-section-note">consegna in room</div>
            </div>
            <div className="addon-grid">
              {snacks.map(a => (
                <AddonCard key={a.id} addon={a} onAdd={item => addToCart({ ...item, id: a.id })} />
              ))}
            </div>
          </section>
        )}

        {/* Cart panel */}
        {cartCount > 0 && (
          <div className="cart-panel show" id="cart-panel">
            <div className="cart-header">
              <span className="cart-count" id="cart-count">{cartCount}</span>
              <span>nel carrello</span>
              <span className="cart-total" id="cart-total">{cartTotal} chips</span>
            </div>
            <div id="cart-items">
              {cart.map((item, i) => (
                <div key={`${item.name}-${i}`} className="cart-item-row">
                  <span className="cart-item-name">{item.qty > 1 ? `${item.qty}x ` : ''}{item.name}</span>
                  <span className="cart-item-price">{item.price * item.qty} chips</span>
                  <span className="cart-item-actions">
                    <button type="button" onClick={() => updateCartItem(item.name, -1)} aria-label={`Diminuisci ${item.name}`}>−</button>
                    <button type="button" onClick={() => updateCartItem(item.name, 1)} aria-label={`Aumenta ${item.name}`}>+</button>
                    <button type="button" onClick={() => removeCartItem(item.name)} aria-label={`Rimuovi ${item.name}`}>
                      <i className="fas fa-times"></i>
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button className="btn-neon" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={handleCheckout} disabled={busy}>
                {busy ? '...' : isLive ? `PAGA ${cartTotal} CHIPS` : 'ATTIVO IN SESSIONE'}
              </button>
              <button onClick={clearCart} style={{ background: 'var(--dark3)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '12px', fontSize: '.8rem' }}>
                Svuota
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AddonCard({ addon, onAdd }: { addon: Addon; onAdd: (item: { name: string; price: number; qty: number }) => void }) {
  const brandClass: Record<string, string> = {
    DAZN: 'brand-dazn', NETFLIX: 'brand-netflix', PS5: 'brand-ps5',
    SPOTIFY: 'brand-spotify', ROOMIE: 'brand-roomie', PARTNER: 'brand-partner',
  }
  return (
    <div className={`addon-chip${addon.category === 'featured' ? ' addon-featured' : ''}`}>
      <div className="addon-visual">
        <i className="fas fa-star"></i>
        <span>{addon.soldToday > 0 ? `${addon.soldToday} oggi` : 'DISPONIBILE'}</span>
      </div>
      {addon.soldToday > 2 && <span className="addon-badge">🔥 POPOLARE</span>}
      {addon.brand && <span className={`brand-mark ${brandClass[addon.brand] || ''}`}>{addon.brand}</span>}
      <div className="addon-name">{addon.name}</div>
      <div className="addon-desc">{addon.description}</div>
      <div className="addon-price">{addon.price} chips</div>
      <button
        className="btn-addon"
        onClick={() => onAdd({ name: addon.name, price: addon.price, qty: 1 })}
      >+ AGGIUNGI</button>
    </div>
  )
}
