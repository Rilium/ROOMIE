'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/app/context/AppContext'
import { HyperText } from '@/app/components/magicui/hyper-text'

const HERO_SLIDES = [
  {
    bg: "url('/assets/images/roomie-hero-slide-1.webp')",
    title: 'LA SERATA',
    neon: 'INIZIA QUI.',
    addr: 'Via Terni, Torino — Prenoti a ore, entri con la tua ROOMIE Chip.',
    sub: 'Il tuo clubhouse privato: divani, console, streaming, carte, amici. Zero locale pieno, zero sbatti.',
    meta: ['12 chips/ora', 'fino a 8 persone'],
  },
  {
    bg: "url('/assets/images/roomie-hero-slide-2.webp')",
    title: 'IL TUO HQ.',
    neon: 'SOLO VOSTRO.',
    addr: 'Gaming, film, partita o cena improvvisata — scegli la sessione.',
    sub: 'Non affitti una stanza: blocchi il quartier generale del gruppo, già pronto quando arrivi.',
    meta: ['preset da 1h a giornata', 'split con amici'],
  },
  {
    bg: "url('/assets/images/roomie-hero-slide-3.webp')",
    title: 'CHIP.',
    neon: 'CODICE. DENTRO.',
    addr: 'Accesso fisico semplice: cassaforte, serranda, porta smart.',
    sub: 'Paghi, ricevi i codici, apri e sei dentro. La ROOMIE Chip rende il rituale più veloce e più premium.',
    meta: ['accesso guidato', 'fallback codice'],
  },
]

const INSIDE_TABS = ['gaming', 'streaming', 'games', 'vibe'] as const
type InsideTab = typeof INSIDE_TABS[number]

export default function LandingLegacy() {
  const { showPage, user } = useApp()
  const router = useRouter()
  const [heroSlide, setHeroSlide] = useState(0)
  const [insideTab, setInsideTab] = useState<InsideTab>('gaming')
  const heroSwipe = useRef<{ x: number; y: number } | null>(null)
  const currentHero = HERO_SLIDES[heroSlide]

  // Hero auto-advance
  useEffect(() => {
    const timer = setInterval(() => setHeroSlide(i => (i + 1) % HERO_SLIDES.length), 5000)
    return () => clearInterval(timer)
  }, [])

  // Init GSAP premium motion (parallax scroll) once on mount
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (typeof w.initPremiumMotion === 'function') {
      setTimeout(() => w.initPremiumMotion(), 100)
    }
  }, [])

  const requireAuthPage = (page: string) => {
    if (user) { showPage(page) } else { router.push(`/sign-in?next=${encodeURIComponent(`/${page}`)}`) }
  }

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const goHeroSlide = (direction: number) => {
    setHeroSlide(i => (i + direction + HERO_SLIDES.length) % HERO_SLIDES.length)
  }

  const handleHeroSwipeEnd = (x: number, y: number) => {
    const start = heroSwipe.current
    heroSwipe.current = null
    if (!start) return
    const dx = x - start.x
    const dy = y - start.y
    if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.2) return
    goHeroSlide(dx < 0 ? 1 : -1)
  }

  const handleHomePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    target.style.setProperty('--home-grid-x', `${event.clientX}px`)
    target.style.setProperty('--home-grid-y', `${event.clientY}px`)
  }

  return (
    <div className="page active home-grid-pattern" id="page-home" onPointerMove={handleHomePointerMove}>

      {/* HERO */}
      <section
        className="hero fp-home-section"
        data-horizontal="hero"
        onPointerDown={event => { heroSwipe.current = { x: event.clientX, y: event.clientY } }}
        onPointerUp={event => handleHeroSwipeEnd(event.clientX, event.clientY)}
        onPointerCancel={() => { heroSwipe.current = null }}
        onTouchStart={event => {
          const touch = event.touches[0]
          if (touch) heroSwipe.current = { x: touch.clientX, y: touch.clientY }
        }}
        onTouchEnd={event => {
          const touch = event.changedTouches[0]
          if (touch) handleHeroSwipeEnd(touch.clientX, touch.clientY)
        }}
      >
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={i}
            className={`hero-bg${heroSlide === i ? ' active' : ''}`}
            style={{ '--slide-image': slide.bg } as React.CSSProperties}
          ></div>
        ))}
        <div className="hero-grid"></div>
        <div className="hero-content">
          <div className="hero-copy">
            <div className="hero-badge">
              <span className="hero-badge-dot"></span>
              LIVE · VIA TERNI
            </div>
            <HyperText as="h1" className="hero-title" duration={900} delay={120}>
              {`${currentHero.title}\n${currentHero.neon}`}
            </HyperText>
            <p className="hero-addr">{currentHero.addr}</p>
            <p className="hero-sub">{currentHero.sub}</p>
          </div>
          <div className="hero-ctas">
            <button className="btn-neon" onClick={() => requireAuthPage('room')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              BLOCCA LA ROOM
            </button>
            <button className="btn-outline-neon" onClick={() => scrollToSection('inside-section')}>
              COSA C&apos;È DENTRO
            </button>
          </div>
          <div className="hero-meta">
            {currentHero.meta.map(item => <span key={item}>{item}</span>)}
          </div>
          <div className="trust-row">
            <div className="trust-pill"><em><i className="fas fa-gamepad"></i></em> Gaming</div>
            <div className="trust-pill"><em><i className="fas fa-film"></i></em> Film</div>
            <div className="trust-pill"><em><i className="fas fa-pizza-slice"></i></em> Serata</div>
            <div className="trust-pill"><em><i className="fas fa-dice"></i></em> Carte</div>
            <div className="trust-pill"><em><i className="fas fa-futbol"></i></em> Partita</div>
          </div>
        </div>
        <div className="hero-dots" aria-label="Hero carousel">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              className={`hero-dot${heroSlide === i ? ' active' : ''}`}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setHeroSlide(i)}
            ></button>
          ))}
        </div>
        <div className="hero-bottom-beam" aria-hidden="true"></div>
      </section>

      {/* INSIDE */}
      <section className="section fp-home-section" id="inside-section" data-horizontal="inside">
        <span className="section-label">Cosa trovi dentro</span>
        <h2 className="section-title">SETUP<br />COMPLETO.</h2>
        <p className="section-sub">Entri e c&apos;è tutto. Acceso, configurato, pronto.</p>
        <div className="inside-tabs">
          {INSIDE_TABS.map(tab => (
            <button
              key={tab}
              className={`inside-tab${insideTab === tab ? ' active' : ''}`}
              onClick={() => setInsideTab(tab)}
            >
              {tab === 'gaming' && <><i className="fas fa-gamepad"></i> Gaming</>}
              {tab === 'streaming' && <>📺 Streaming</>}
              {tab === 'games' && <><i className="fas fa-dice"></i> Games</>}
              {tab === 'vibe' && <>🛋 Vibe</>}
            </button>
          ))}
        </div>

        <div className={`inside-panel${insideTab === 'gaming' ? ' active' : ''}`} id="inside-gaming">
          <p className="section-kicker">CONSOLE & GAMING</p>
          <div className="inside-grid mb-24">
            {[
              { icon: 'fa-gamepad', name: 'PlayStation 5', sub: 'Con 2 controller' },
              { icon: 'fa-gamepad', name: 'PlayStation 4', sub: 'Libreria completa' },
              { icon: 'fa-gamepad', name: 'PlayStation 3', sub: 'Classici garantiti' },
              { icon: '🎯', name: 'Xbox Series X', sub: 'Game Pass incluso' },
              { icon: '🃏', name: 'Xbox 360', sub: 'Nostalgia mode' },
              { icon: '🍄', name: 'Super Nintendo', sub: 'SNES originale' },
              { icon: '🖥', name: 'PC Gaming', sub: 'RTX 4080 · 240Hz' },
              { icon: '🕹', name: 'Arcade stick', sub: 'Fighting games' },
            ].map((item, i) => (
              <div key={i} className="inside-item">
                <span className="inside-icon">
                  {item.icon.startsWith('fa-') ? <i className={`fas ${item.icon}`}></i> : item.icon}
                </span>
                <div className="inside-name">{item.name}</div>
                <div className="inside-sub">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`inside-panel${insideTab === 'games' ? ' active' : ''}`} id="inside-games">
          <p className="section-kicker">GIOCHI DA TAVOLO & CARTE</p>
          <div className="inside-grid mb-24">
            {[
              { icon: '🃏', name: 'Briscola', sub: '+ Scopa, Tresette' },
              { icon: '🧙', name: 'Magic: The Gathering', sub: 'Mazzi disponibili' },
              { icon: 'fa-dice', name: 'Uno', sub: '+20 giochi di carte' },
              { icon: '♟', name: 'Scacchi', sub: 'Dama inclusa' },
              { icon: '🏰', name: 'Catan', sub: 'Espansioni incluse' },
              { icon: '🐚', name: 'Jenga XXL', sub: 'Versione gigante' },
            ].map((item, i) => (
              <div key={i} className="inside-item">
                <span className="inside-icon">
                  {item.icon.startsWith('fa-') ? <i className={`fas ${item.icon}`}></i> : item.icon}
                </span>
                <div className="inside-name">{item.name}</div>
                <div className="inside-sub">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`inside-panel${insideTab === 'streaming' ? ' active' : ''}`} id="inside-streaming">
          <p className="section-kicker">STREAMING INCLUSO</p>
          <div className="logos-strip mb-24">
            <div className="logo-pill logo-netflix">NETFLIX</div>
            <div className="logo-pill logo-prime">PRIME VIDEO</div>
            <div className="logo-pill logo-disney">DISNEY+</div>
            <div className="logo-pill logo-dazn">DAZN</div>
            <div className="logo-pill logo-twitch">TWITCH</div>
            <div className="logo-pill logo-youtube">YOUTUBE</div>
            <div className="logo-pill" style={{ color: '#ff6b35', borderColor: '#ff6b35' }}>CRUNCHYROLL</div>
            <div className="logo-pill" style={{ color: '#ff0f7b', borderColor: '#ff0f7b' }}>MUBI</div>
          </div>
          <div className="flex flex-wrap gap-8 mb-32">
            <div className="console-pill console-ps">PS1 · PS2 · PS3 · PS4 · PS5</div>
            <div className="console-pill console-xbox">XBOX · XBOX 360 · SERIES X</div>
            <div className="console-pill console-nintendo">SUPER NINTENDO · N64 · GAMECUBE</div>
            <div className="console-pill console-pc">PC GAMING · 4K · 240Hz</div>
          </div>
        </div>

        <div className={`inside-panel${insideTab === 'vibe' ? ' active' : ''}`} id="inside-vibe">
          <p className="section-kicker">SPAZIO & AMBIENTE</p>
          <div className="inside-grid">
            {[
              { icon: '📺', name: 'TV 75"', sub: 'OLED · Dolby Vision' },
              { icon: '🔊', name: 'Soundbar Bose', sub: 'Surround 5.1' },
              { icon: '💡', name: 'Luci Neon', sub: 'RGB controllabile' },
              { icon: '🛋', name: 'Divano XL', sub: 'Fino a 8 persone' },
              { icon: '📡', name: 'Wi-Fi 1 Gbps', sub: 'Fibra dedicata' },
              { icon: '❄', name: 'Clima', sub: 'Caldo/freddo incluso' },
            ].map((item, i) => (
              <div key={i} className="inside-item">
                <span className="inside-icon">{item.icon}</span>
                <div className="inside-name">{item.name}</div>
                <div className="inside-sub">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RULES */}
      <section className="section fp-home-section" id="home-rules-section">
        <span className="section-label">Regole room</span>
        <h2 className="section-title">POCHE REGOLE.<br />ZERO DUBBI.</h2>
        <p className="section-sub">Spazio privato, liberta&apos; totale nel rispetto della room.</p>
        <div className="rules-card">
          <p className="rules-copy">
            Lo spazio e&apos; tuo per le ore che prenoti. Fai quello che vuoi.
            <strong className="text-neon"> Se rompi, paghi.</strong> Semplice.
            Ci sono le telecamere, quindi nessun malinteso.
          </p>
          <div className="flex flex-wrap gap-8">
            <div className="trust-pill">Max 8 persone</div>
            <div className="trust-pill">24h su 24 prenotabile</div>
            <div className="trust-pill">Pulizia garantita</div>
            <div className="trust-pill">Privacy totale</div>
            <div className="trust-pill trust-pill-accent"><i className="fas fa-video"></i> Telecamere attive</div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section fp-home-section home-how-section" id="home-how-section">
        <span className="section-label">Come funziona</span>
        <h2 className="section-title">4 STEP.<br />POI SEI DENTRO.</h2>
        <div className="grid2 how-grid">
          {[
            { n: '01', title: 'Scegli data e ore', copy: 'Ore singole o giornata intera. Fino a 8 persone.' },
            { n: '02', title: 'Paga in chips', copy: 'Ricarichi il saldo e lo usi per tutto: room, addon, shop.' },
            { n: '03', title: 'Apri la cassaforte', copy: 'Il codice apre il lucchetto sulla finestra sinistra. Dentro trovi la chiave della serranda.' },
            { n: '04', title: 'Serranda, poi porta', copy: 'Alzi la serranda con la chiave, la riponi, poi apri la porta con chip NFC o codice.' },
          ].map(s => (
            <div key={s.n} className="chip how-card">
              <div className="how-step-num">{s.n}</div>
              <div className="how-step-title">{s.title}</div>
              <div className="how-step-copy">{s.copy}</div>
            </div>
          ))}
        </div>
        <div className="mt-24 text-center">
          <button className="btn-neon" onClick={() => requireAuthPage('room')}>PRENOTA ADESSO</button>
        </div>
      </section>

    </div>
  )
}
