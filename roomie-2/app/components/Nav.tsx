'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/app/context/AppContext'
import { ShineBorder } from '@/app/components/magicui/shine-border'
import ChipAmount from '@/app/components/ui/ChipAmount'
import RoomieLogoText from '@/app/components/ui/RoomieLogoText'
import { isBookingLiveNow } from '@/lib/utils'

interface NavItem {
  id: string
  icon: string
  label: string
  requireAuth?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', icon: 'fa-home', label: 'Home' },
  { id: 'room', icon: 'fa-calendar-check', label: 'Prenota' },
  { id: 'session', icon: 'fa-unlock', label: 'Accesso', requireAuth: true },
  { id: 'shop', icon: 'fa-shopping-bag', label: 'Shop', requireAuth: true },
  { id: 'dashboard', icon: 'fa-user', label: 'Account', requireAuth: true },
]

export default function Nav() {
  const { activePage, showPage, user, logout, openLegalDoc, activeSession } = useApp()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [bottomCompact, setBottomCompact] = useState(false)
  const lastScrollYRef = useRef(0)
  const liveBooking = activeSession?.booking
  const hasLiveRoom = Boolean(liveBooking && isBookingLiveNow(liveBooking) && activeSession?.doorDone)

  useEffect(() => {
    const setCompact = (compact: boolean) => {
      setBottomCompact(compact)
      document.body.classList.toggle('mobile-nav-compact', compact)
    }

    lastScrollYRef.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - lastScrollYRef.current
      if (y > 80 && delta > 8) setCompact(true)
      if (delta < -8 || y < 40) setCompact(false)
      lastScrollYRef.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.body.classList.remove('mobile-nav-compact')
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('has-system-live-bar', hasLiveRoom)
    return () => document.body.classList.remove('has-system-live-bar')
  }, [hasLiveRoom])

  const handleNav = (item: NavItem) => {
    if (item.requireAuth && !user) {
      setDrawerOpen(false)
      router.push(`/sign-in?next=${encodeURIComponent(item.id === 'room' ? '/room' : `/${item.id}`)}`)
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
    showPage('room')
  }

  const visibleItems = NAV_ITEMS.filter(item => {
    // Nascondi "Accesso" se non c'è sessione attiva e non si è sulla pagina confirm/session
    if (item.id === 'session') {
      return Boolean(activeSession?.booking) || ['confirm', 'session'].includes(activePage)
    }
    // Da sloggato la bottom nav deve restare secca: Home, Prenota, Profilo.
    // Lo shop resta raggiungibile dopo login, così non promette acquisti fuori contesto.
    if (!user && item.id === 'shop') return false
    return true
  })

  return (
    <>
      {hasLiveRoom && (
        <button className="system-live-bar" type="button" onClick={() => showPage('session')} aria-label="Vai alla pagina Sei dentro">
          <ShineBorder duration={5.5} initialOffset={22} colorFrom="#ff3b30" colorTo="#00ffd1" borderWidth={1.2} />
          <span className="system-live-pill">
            <span className="system-live-dot" aria-hidden="true"></span>
            <RoomieLogoText size="xs" /> LIVE
          </span>
          <span className="system-live-main">
            <strong>Sei dentro</strong>
            <span>Controlli, cam e shop attivi fino alle {liveBooking?.end || '--:--'}</span>
          </span>
          <span className="system-live-action">
            Apri <i className="fas fa-arrow-right"></i>
          </span>
        </button>
      )}
      <nav className="roomie-nav" aria-label="Navigazione principale">
        <div className="container-fluid">
          <div className="nav-left">
            <button
              className="hamburger btn btn-outline-light"
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Apri menu"
              aria-expanded={drawerOpen}
            >
              <i className="fas fa-bars"></i>
            </button>
            <button className="nav-logo" type="button" onClick={goHome} aria-label="ROOMIE home">
              <RoomieLogoText size="md" />
            </button>
          </div>

          <div className="nav-right">
            {user && (
              <button className="wallet-pill" type="button" onClick={() => showPage('token')} aria-label={`${user.chips} chips`}>
                <ChipAmount amount={user.chips} size="xs" />
              </button>
            )}
            <button className="btn-nav btn btn-primary" type="button" onClick={goBook}>PRENOTA</button>
          </div>
        </div>
      </nav>

      {drawerOpen && (
        <div className="drawer-panel offcanvas-backdrop show" role="dialog" aria-modal="true" aria-label="Menu ROOMIE" onClick={() => setDrawerOpen(false)}>
          <div className="drawer-box offcanvas offcanvas-start show" tabIndex={-1} onClick={event => event.stopPropagation()}>
            <div className="drawer-head offcanvas-header">
              <div>
                <div className="drawer-brand"><RoomieLogoText size="md" /></div>
                <div className="drawer-user">{user ? <>{user.name} · <ChipAmount amount={user.chips} size="xs" /></> : 'Clubhouse privata · Torino'}</div>
              </div>
              <button className="modal-close btn btn-outline-light" type="button" onClick={() => setDrawerOpen(false)} aria-label="Chiudi menu">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <button className="drawer-primary btn btn-primary" type="button" onClick={goBook}>
              <span className="drawer-primary-copy">
                <span className="drawer-primary-title">Prenota la room</span>
                <span className="drawer-primary-sub">{user ? 'Blocca uno slot e usa le chips' : 'Vedi prezzo e disponibilita, login al checkout'}</span>
              </span>
              <span className="drawer-primary-meta">
                <span>{user ? <ChipAmount amount={user.chips} size="xs" /> : 'Login'}</span>
                <i className="fas fa-arrow-right"></i>
              </span>
            </button>

            <div className="drawer-section">Principale</div>
            {visibleItems.map(item => (
              <button key={item.id} className={`drawer-link list-group-item list-group-item-action${activePage === item.id ? ' active' : ''}`} type="button" onClick={() => handleNav(item)} aria-current={activePage === item.id ? 'page' : undefined}>
                <span className="drawer-icon"><i className={`fas ${item.icon}`}></i></span>
                <span>
                  <span className="drawer-main">{item.label}</span>
                  <span className="drawer-sub">
                    {item.requireAuth && !user
                      ? 'Accedi per aprire'
                      : item.id === activePage
                        ? 'Sezione attiva'
                        : item.id === 'shop'
                          ? 'Solo in sessione'
                          : item.id === 'session'
                            ? 'Entrata fisica'
                            : 'Apri'}
                  </span>
                </span>
                <i className="fas fa-chevron-right drawer-chevron"></i>
              </button>
            ))}

            {user?.role === 'admin' && (
              <>
                <div className="drawer-section">Back office</div>
                <button className={`drawer-link drawer-admin${activePage === 'admin' ? ' active' : ''}`} type="button" onClick={() => { setDrawerOpen(false); showPage('admin') }} aria-current={activePage === 'admin' ? 'page' : undefined}>
                  <span className="drawer-icon"><i className="fas fa-shield-alt"></i></span>
                  <span>
                    <span className="drawer-main">Admin</span>
                    <span className="drawer-sub">Operazioni, config e log</span>
                  </span>
                  <i className="fas fa-chevron-right drawer-chevron"></i>
                </button>
              </>
            )}

            <div className="drawer-section drawer-legal-section">Legale</div>
            {(['terms', 'privacy', 'cookie'] as const).map(doc => (
              <button key={doc} className="drawer-link drawer-legal-link" type="button" onClick={() => { setDrawerOpen(false); openLegalDoc(doc) }}>
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

      <nav className={`mobile-bottom-nav${bottomCompact ? ' is-compact' : ''}`} aria-label="Navigazione mobile">
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
