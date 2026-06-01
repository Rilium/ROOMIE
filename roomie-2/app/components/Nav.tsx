'use client'

import { useState } from 'react'
import { useApp } from '@/app/context/AppContext'

interface NavItem {
  id: string
  icon: string
  label: string
  requireAuth?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', icon: 'fa-home', label: 'Home' },
  { id: 'room', icon: 'fa-calendar-check', label: 'Prenota', requireAuth: true },
  { id: 'session', icon: 'fa-unlock', label: 'Accesso', requireAuth: true },
  { id: 'shop', icon: 'fa-shopping-bag', label: 'Shop', requireAuth: true },
  { id: 'dashboard', icon: 'fa-user', label: 'Profilo', requireAuth: true },
]

export default function Nav() {
  const { activePage, showPage, user, openAuth, logout, openLegalDoc } = useApp()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleNav = (item: NavItem) => {
    if (item.requireAuth && !user) {
      setDrawerOpen(false)
      openAuth('login')
      return
    }
    setDrawerOpen(false)
    showPage(item.id)
  }

  const goHome = () => {
    setDrawerOpen(false)
    showPage('home')
  }

  const goBook = () => {
    setDrawerOpen(false)
    if (!user) openAuth('login')
    else showPage('room')
  }

  const goProfile = () => {
    setDrawerOpen(false)
    if (!user) openAuth('login')
    else showPage('dashboard')
  }

  const visibleItems = NAV_ITEMS.filter(item => {
    // Nascondi "Accesso" se non c'è sessione attiva e non si è sulla pagina confirm/session
    if (item.id === 'session') {
      return ['confirm', 'session'].includes(activePage)
    }
    // Da sloggato la bottom nav deve restare secca: Home, Prenota, Profilo.
    // Lo shop resta raggiungibile dopo login, così non promette acquisti fuori contesto.
    if (!user && item.id === 'shop') return false
    return true
  })

  return (
    <>
      <nav className="roomie-nav" aria-label="Navigazione principale">
        <div className="container-fluid">
          <div className="nav-left">
            <button
              className="hamburger"
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Apri menu"
              aria-expanded={drawerOpen}
            >
              <i className="fas fa-bars"></i>
            </button>
            <button className="nav-logo" type="button" onClick={goHome} aria-label="ROOMIE home">
              <span className="logo-room">ROOM</span><span className="logo-ie">IE</span>
            </button>
          </div>

          <div className="nav-right">
            {user && (
              <button className="wallet-pill" type="button" onClick={() => showPage('token')} aria-label={`${user.chips} chips`}>
                <span className="roomie-chip roomie-chip-sm" aria-hidden="true"></span>
                <span>{user.chips}</span>
              </button>
            )}
            <button className="btn-nav" type="button" onClick={goBook}>PRENOTA</button>
          </div>
        </div>
      </nav>

      {drawerOpen && (
        <div className="drawer-panel" role="dialog" aria-modal="true" aria-label="Menu ROOMIE" onClick={() => setDrawerOpen(false)}>
          <div className="drawer-box" onClick={event => event.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div className="drawer-brand">ROOMIE</div>
                <div className="drawer-user">{user ? `${user.name} · ${user.chips} chips` : 'Clubhouse privata · Torino'}</div>
              </div>
              <button className="modal-close" type="button" onClick={() => setDrawerOpen(false)} aria-label="Chiudi menu">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <button className="drawer-primary" type="button" onClick={goBook}>
              <span>PRENOTA LA ROOM</span>
              <i className="fas fa-arrow-right"></i>
            </button>

            <div className="drawer-section">Navigazione</div>
            {visibleItems.map(item => (
              <button key={item.id} className="drawer-link" type="button" onClick={() => handleNav(item)}>
                <span className="drawer-icon"><i className={`fas ${item.icon}`}></i></span>
                <span>
                  <span className="drawer-main">{item.label}</span>
                  <span className="drawer-sub">{item.requireAuth && !user ? 'Accesso richiesto' : item.id === activePage ? 'Sezione attiva' : 'Apri sezione'}</span>
                </span>
                <i className="fas fa-chevron-right drawer-chevron"></i>
              </button>
            ))}

            {user?.role === 'admin' && (
              <>
                <div className="drawer-section">Back office</div>
                <button className="drawer-link drawer-admin" type="button" onClick={() => { setDrawerOpen(false); showPage('admin') }}>
                  <span className="drawer-icon"><i className="fas fa-shield-alt"></i></span>
                  <span>
                    <span className="drawer-main">Admin</span>
                    <span className="drawer-sub">Operazioni e configurazione</span>
                  </span>
                  <i className="fas fa-chevron-right drawer-chevron"></i>
                </button>
              </>
            )}

            <div className="drawer-section">Legale</div>
            {(['terms', 'privacy', 'cookie'] as const).map(doc => (
              <button key={doc} className="drawer-link" type="button" onClick={() => { setDrawerOpen(false); openLegalDoc(doc) }}>
                <span className="drawer-icon"><i className="fas fa-file-contract"></i></span>
                <span>
                  <span className="drawer-main">{doc === 'terms' ? 'Termini' : doc === 'privacy' ? 'Privacy' : 'Cookie'}</span>
                  <span className="drawer-sub">Apri documento</span>
                </span>
                <i className="fas fa-chevron-right drawer-chevron"></i>
              </button>
            ))}

            {user && (
              <button className="drawer-link drawer-logout" type="button" onClick={() => { setDrawerOpen(false); logout() }}>
                <span className="drawer-icon"><i className="fas fa-sign-out-alt"></i></span>
                <span>
                  <span className="drawer-main">Logout</span>
                  <span className="drawer-sub">Esci da questo dispositivo</span>
                </span>
                <i className="fas fa-chevron-right drawer-chevron"></i>
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav" aria-label="Navigazione mobile">
        {visibleItems.map(item => (
          <button
            key={item.id}
            className={`mbn-btn${activePage === item.id ? ' active' : ''}${item.id === 'shop' ? ' shop-live-glow' : ''}`}
            type="button"
            onClick={() => handleNav(item)}
            aria-label={item.label}
            aria-current={activePage === item.id ? 'page' : undefined}
          >
            <span className="mbn-icon"><i className={`fas ${item.icon}`}></i></span>
            <span className="mbn-label">{item.label}</span>
          </button>
        ))}
        {user?.role === 'admin' && (
          <button className={`mbn-btn${activePage === 'admin' ? ' active' : ''}`} type="button" onClick={() => showPage('admin')} aria-label="Admin">
            <span className="mbn-icon"><i className="fas fa-shield-alt"></i></span>
            <span className="mbn-label">Admin</span>
          </button>
        )}
      </nav>
    </>
  )
}
