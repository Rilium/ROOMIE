'use client'

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
  const { activePage, showPage, user, openAuth } = useApp()

  const handleNav = (item: NavItem) => {
    if (item.requireAuth && !user) {
      openAuth('login')
      return
    }
    showPage(item.id)
  }

  const visibleItems = NAV_ITEMS.filter(item => {
    // Nascondi "Accesso" se non c'è sessione attiva e non si è sulla pagina confirm/session
    if (item.id === 'session') {
      return ['confirm', 'session'].includes(activePage)
    }
    return true
  })

  return (
    <nav className="bottom-nav" aria-label="Navigazione principale">
      {visibleItems.map(item => (
        <button
          key={item.id}
          className={`bottom-nav-item${activePage === item.id ? ' active' : ''}`}
          type="button"
          onClick={() => handleNav(item)}
          aria-label={item.label}
          aria-current={activePage === item.id ? 'page' : undefined}
        >
          <i className={`fas ${item.icon}`}></i>
          <span>{item.label}</span>
        </button>
      ))}
      {user?.role === 'admin' && (
        <button
          className={`bottom-nav-item${activePage === 'admin' ? ' active' : ''}`}
          type="button"
          onClick={() => showPage('admin')}
          aria-label="Admin"
        >
          <i className="fas fa-shield-alt"></i>
          <span>Admin</span>
        </button>
      )}
    </nav>
  )
}
