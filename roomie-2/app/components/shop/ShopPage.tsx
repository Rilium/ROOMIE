'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '@/app/context/AppContext'
import { ShineBorder } from '@/app/components/magicui/shine-border'
import { apiGetAddons, apiOrderAddons } from '@/lib/client-api'
import { isBookingLiveNow } from '@/lib/utils'
import type { Addon } from '@/lib/types'

export default function ShopPage() {
  const { user, cart, addToCart, updateCartItem, removeCartItem, clearCart, showToast, showPage, activePage, activeSession } = useApp()
  const [addons, setAddons] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiGetAddons().then(({ data }) => {
      if (!cancelled && data?.addons) setAddons(data.addons)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [activePage])

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const isLive = Boolean(activeSession?.booking && isBookingLiveNow(activeSession.booking))
  const balance = user?.chips ?? 0

  const lockShop = useCallback(() => {
    showToast({
      title: 'Shop disponibile quando sei dentro',
      copy: 'Puoi guardare pack e prezzi ora; pagamento e attivazione partono solo durante la sessione live.',
      type: 'warn',
    })
  }, [showToast])

  const addAddon = useCallback((addon: Addon) => {
    if (!isLive) { lockShop(); return }
    addToCart({ id: addon.id, name: addon.name, price: addon.price, qty: 1 })
  }, [addToCart, isLive, lockShop])

  const addPack = useCallback((items: Array<{ name: string; price: number }>) => {
    if (!isLive) { lockShop(); return }
    items.forEach(item => {
      const addon = addons.find(a => a.name === item.name && a.status === 'active')
      addToCart({ id: addon?.id, name: item.name, price: item.price, qty: 1 })
    })
  }, [addons, addToCart, isLive, lockShop])

  const handleCheckout = useCallback(async () => {
    if (!isLive) { lockShop(); return }
    if (!activeSession?.booking?.id) { showToast({ title: 'Nessuna sessione attiva', type: 'warn' }); return }
    if (balance < cartTotal) { showToast({ title: 'Chips insufficienti', type: 'warn' }); showPage('token'); return }
    setBusy(true)
    const items = cart.filter(i => i.id).map(i => ({ id: i.id!, qty: i.qty }))
    if (!items.length) {
      setBusy(false)
      showToast({ title: 'Pack non disponibile', copy: 'Scegli almeno un addon singolo dalla lista live.', type: 'warn' })
      return
    }
    const { error } = await apiOrderAddons({ bookingId: activeSession.booking.id, items })
    setBusy(false)
    if (error) { showToast({ title: error, type: 'warn' }); return }
    clearCart()
    showToast({ title: 'Ordine confermato! Attivazione in corso.' })
  }, [isLive, lockShop, activeSession, balance, cartTotal, cart, clearCart, showToast, showPage])

  const featured = addons.filter(a => a.category === 'featured' && a.status === 'active')
  const modes = addons.filter(a => a.category === 'modes' && a.status === 'active')
  const snacks = addons.filter(a => a.category === 'snacks' && a.status === 'active')

  // Cart panel rendered as a portal on document.body so it stays truly fixed
  const cartPanel = mounted && cartCount > 0 ? createPortal(
    <div className="cart-panel" role="region" aria-label="Carrello" aria-live="polite">
      <ShineBorder size={118} duration={6.8} initialOffset={58} colorFrom="#FFEA00" colorTo="#7C5CFF" borderWidth={1.4} />
      {/* Head */}
      <div className="cart-head">
        <span className="cart-title">CARRELLO</span>
        <span className="cart-count">{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
        <button
          type="button"
          onClick={clearCart}
          className="cart-clear-btn"
          aria-label="Svuota carrello"
        >
          SVUOTA
        </button>
      </div>

      {/* Item rows with qty controls */}
      <div className="roomie-stack-2">
        {cart.map((item, i) => (
          <div key={`${item.name}-${i}`} className="cart-item-row">
            <span className="cart-item-name">{item.name}</span>
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

      {/* Footer */}
      <div className="cart-footer">
        <div>
          <div className="cart-total-label">TOTALE</div>
          <div className="cart-total-val">{cartTotal} <span className="cart-total-unit">chips</span></div>
        </div>
        <button
          className="cart-pay"
          onClick={handleCheckout}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? '...' : isLive ? `PAGA ${cartTotal}` : 'IN SESSIONE'}
        </button>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className={`page active${isLive ? '' : ' shop-locked'}`} id="page-shop">
      <div className={`shop-inner${cartCount > 0 ? ' has-cart' : ''}`}>
        <div className="shop-hero">
          <span className="addon-badge">SHOP SESSIONE</span>
          <div className="shop-hero-title">POTENZIA<br />LA SESSIONE.</div>
          <div className="shop-hero-sub">Addon immediati, snack e setup extra. Paghi in chips, si attivano durante la sessione.</div>
        </div>

        {!isLive && (
          <div className="shop-locked-banner">
            <strong>Shop in anteprima.</strong> Puoi esplorare pack e prezzi, ma il pagamento si sblocca solo quando sei fisicamente dentro la sessione. Appena la room e&apos; live, carrello e addon diventano attivabili.
            <button type="button" className="shop-lock-cta" onClick={() => showPage(activeSession?.booking ? 'session' : 'dashboard')}>
              {activeSession?.booking ? 'VAI ALLA SESSIONE' : 'VEDI PROSSIMA PRENOTAZIONE'}
            </button>
          </div>
        )}

        {isLive && (
          <div className="shop-session-context is-live">
            <div><strong>Sessione live</strong><span>Saldo: {balance} chips · Carrello: {cartTotal} chips</span></div>
          </div>
        )}

        {loading ? (
          <div className="page-skeleton shop-skeleton" aria-label="Caricamento addon">
            <div className="page-skeleton-header">
              <div className="roomie-skeleton roomie-skeleton-line lg shimmer" style={{ width: '44%' }}></div>
              <div className="roomie-skeleton roomie-skeleton-line shimmer" style={{ width: '70%' }}></div>
            </div>
            <div className="page-skeleton-grid">
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
            </div>
          </div>
        ) : (
          <>
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
                  <button className="bundle-btn" onClick={() => addPack([
                    { name: 'DAZN Partita', price: 5 },
                    { name: 'Soft drinks ×6', price: 6 },
                    { name: 'Snack Box', price: 5 },
                  ])}>{isLive ? 'AGGIUNGI PACK' : 'DISPONIBILE LIVE'}</button>
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
                  <button className="bundle-btn" onClick={() => addPack([
                    { name: 'Gaming Pro Setup', price: 8 },
                    { name: 'Neon Party', price: 4 },
                  ])}>{isLive ? 'AGGIUNGI' : 'DISPONIBILE LIVE'}</button>
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
                    <AddonCard key={a.id} addon={a} locked={!isLive} onAdd={() => addAddon(a)} />
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
                    <AddonCard key={a.id} addon={a} locked={!isLive} onAdd={() => addAddon(a)} />
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
                    <AddonCard key={a.id} addon={a} locked={!isLive} onAdd={() => addAddon(a)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {cartPanel}
    </div>
  )
}

function AddonCard({ addon, locked, onAdd }: { addon: Addon; locked?: boolean; onAdd: () => void }) {
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
        onClick={onAdd}
      >{locked ? 'LIVE ONLY' : '+ AGGIUNGI'}</button>
    </div>
  )
}
