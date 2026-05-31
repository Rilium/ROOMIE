# MIGRATION AUDIT — ROOMIE → roomie-2 (Next.js)

Generato: 2026-05-30  
Sorgente: `/ROOMIE/` (Express monolitico)  
Destinazione: `/ROOMIE/roomie-2/` (Next.js App Router + TypeScript)

---

## 1. ROUTE EXPRESS ATTUALI (`server.js`)

### Auth
| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/auth/login` | Login con username/email + password |
| POST | `/api/auth/register` | Registrazione nuovo utente |
| POST | `/api/auth/logout` | Logout (requireAuth) |
| GET | `/api/auth/google` | Avvia OAuth Google (redirect) |
| GET | `/api/auth/google/callback` | Callback OAuth Google (code flow o bridge HTML) |
| POST | `/api/auth/google/token` | Verifica id_token Google (implicit flow) |
| GET | `/api/auth/apple` | Apple OAuth (non configurato → redirect error) |

### Utente corrente
| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/me` | Ritorna utente sessione corrente (pubblico: 401 se non auth) |

### Configurazione pubblica
| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/app/config` | Config prezzi, blockedSlots, bookedSlots |
| GET | `/api/addons` | Lista addons attivi |

### Prenotazioni
| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/bookings` | Prenotazioni utente (admin: tutte) |
| POST | `/api/bookings` | Crea prenotazione (requireAuth) |
| POST | `/api/bookings/:id/extend` | Estendi prenotazione +ore (requireAuth) |

### Dashboard & amici
| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/dashboard` | Summary completo (user, bookings, stats, mission) |
| GET | `/api/friends/platform` | Lista utenti piattaforma come amici |

### Wallet
| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/wallet/topup` | Ricarica manuale chips (requireAuth, dev only) |

### Stripe
| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/stripe/topup-checkout` | Crea sessione Stripe checkout (requireAuth) |
| GET | `/api/stripe/success` | Redirect post-pagamento, accredita chips (requireAuth) |
| POST | `/api/stripe/webhook` | Webhook Stripe (raw body, firma verificata) |

### Admin (requireAdmin)
| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/admin/summary` | Tutto: revenue, bookings, users, addons, access, config, audit |
| PATCH | `/api/admin/bookings/:id/status` | Aggiorna status prenotazione |
| PATCH | `/api/admin/bookings/:id` | Modifica prenotazione (data, ora, persone, chips, status) |
| PATCH | `/api/admin/users/:id/chips` | Aggiusta saldo chips utente |
| PATCH | `/api/admin/users/:id` | Aggiorna profilo utente (name, email, role, suspended) |
| PATCH | `/api/admin/config` | Aggiorna config (prezzi, codice cassaforte) |
| POST | `/api/admin/addons` | Crea addon |
| PATCH | `/api/admin/addons/:id` | Modifica addon |
| DELETE | `/api/admin/addons/:id` | Soft-delete addon (status = deleted) |
| POST | `/api/admin/blocked-slots` | Blocca slot |
| DELETE | `/api/admin/blocked-slots/:id` | Sblocca slot |

### Health
| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/health/oauth` | Stato config OAuth Google |
| GET | `/api/health/storage` | Stato storage (postgres / local-json) |
| GET | `/api/health/payments` | Stato config Stripe |

### Static/HTML
| Method | Path | Handler |
|--------|------|---------|
| GET | `/` | Serve `public/index.html` |
| GET | `/ui-preview-v2.html` | Redirect 301 → `/index.html` |
| `*` | `public/*` | Static file serving |

---

## 2. ENDPOINT API — CONTRATTI I/O

### POST /api/auth/login
**Input:** `{ username, password, remember }`  
**Output 200:** `{ user: PublicUser }`  
**Errori:** 401 `BAD_CREDENTIALS`, 403 `ADMIN_DEFAULT_PASSWORD_DISABLED` / `USER_SUSPENDED`

### POST /api/auth/register
**Input:** `{ name, username, email, password, remember }`  
**Output 201:** `{ user: PublicUser }`  
**Errori:** 400 `BAD_NAME/BAD_USERNAME/BAD_EMAIL/WEAK_PASSWORD`, 409 `USERNAME_TAKEN/EMAIL_TAKEN`

### GET /api/me
**Output 200:** `{ user: PublicUser | null }`

### GET /api/app/config
**Output 200:** `{ config: AppConfig, blockedSlots: Slot[], bookedSlots: SlotPreview[] }`

### GET /api/addons
**Output 200:** `{ addons: Addon[] }`

### GET /api/bookings
**Output 200:** `{ bookings: Booking[] }`

### POST /api/bookings
**Input:** `{ date, start, end, people, totalChips, [mood] }`  
**Output 201:** `{ booking: Booking, user: PublicUser }`  
**Errori:** 400 `BAD_TOTAL/BAD_BOOKING_TIME/BAD_PEOPLE`, 402 `INSUFFICIENT_CHIPS`, 409 `SLOT_BLOCKED`

### POST /api/bookings/:id/extend
**Input:** `{ hours }`  
**Output 200:** `{ booking: Booking, user: PublicUser, charged: number }`

### GET /api/dashboard
**Output 200:** `{ user, bookings, next, history, stats, mission, recommended, recommendedAddons }`

### GET /api/friends/platform
**Output 200:** `{ friends: Friend[] }`

### POST /api/wallet/topup
**Input:** `{ amount }`  
**Output 200:** `{ user: PublicUser, amount }`

### POST /api/stripe/topup-checkout
**Input:** `{ amount, returnPage }`  
**Output 200:** `{ url: string }`

### GET /api/stripe/success
**Query:** `session_id, return`  
**Output:** redirect `/?page=...&stripe=success|already|pending|error`

### POST /api/stripe/webhook
**Body:** raw JSON + `stripe-signature` header  
**Output 200:** `{ received: true }`

### GET /api/admin/summary
**Output 200:** `{ user, summary, bookings, recentBookings, users, access, config, addons, addonOrders, blockedSlots, auditLog }`

---

## 3. TIPI BASE (derivati dal codice)

```typescript
interface PublicUser {
  id: string
  username: string
  email: string
  name: string
  role: 'user' | 'admin'
  chips: number
  suspended: boolean
}

interface AppConfig {
  hourlyPrice: number   // default 12
  dayPrice: number      // default 60
  guestPassPrice: number // default 2
  maxPeople: number     // default 8
  lockboxCode: string   // default '4729'
}

interface Booking {
  id: string
  userId: string
  room: string
  date: string          // YYYY-MM-DD
  start: string         // HH:MM
  end: string           // HH:MM
  people: number
  totalChips: number
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled'
  lockboxCode?: string
  doorCode?: string
  accessValidUntil?: string
  liveMode?: boolean
  createdAt: string
}

interface Addon {
  id: string
  category: 'featured' | 'modes' | 'snacks'
  brand: string
  name: string
  description: string
  price: number
  status: 'active' | 'soldout' | 'hidden' | 'deleted'
  soldToday: number
}
```

---

## 4. FUNZIONI JS PRINCIPALI (`roomie.js` — 3285 righe)

### Inizializzazione
- `DOMContentLoaded` → init cascata: `initHeroCarousel`, `initAuthBackground`, `initAnimatedFavicon`, `bindAccessFlow`, `renderFriendSelection`, `updateShopAccessUI`, `loadAppConfig`, `updatePrice`, `updateBookingStep`, `initPremiumMotion`
- `initAuth(initialPage)` — controlla sessione, carica user, gestisce redirect post-OAuth e stripe status
- `loadAppConfig()` — fetcha config e addons dal backend, applica al client

### Auth
- `login(event)` — POST /api/auth/login, gestisce transizione e post-auth wow
- `register(event)` — POST /api/auth/register
- `logout()` — POST /api/auth/logout, reset stato globale
- `openAuth(mode)` / `closeAuth()` — mostra/nasconde auth screen
- `setAuthMode(mode)` — toggle login/register tab
- `showPostAuthWow(kind)` — modal post-login con confetti
- `socialLogin(provider)` — redirect a /api/auth/{provider}
- `applyAuthState()` — aggiorna DOM dopo cambio utente

### Navigazione
- `showPage(id, push)` — navigazione SPA tra 9 pagine
- `goBack()` — history stack custom
- `openMenu()` / `closeMenu()` — side drawer
- `updateSubbar(id)` — breadcrumb subbar

### Booking
- `setPreset(btn, preset, hours, total, start, type)` — imposta sessione da preset
- `setBookingMode(mode)` — now/plan
- `setBookingStep(index)` — stepper 4-step
- `bookingNext()` / `bookingPrev()`
- `updatePrice()` — ricalcola currentTotal (ore × prezzo + guest)
- `goCheckout()` — naviga a pagina checkout con riepilogo
- `confirmBookingPayment()` — POST /api/bookings, poi naviga a confirm
- `setDur(btn, hours)` — cambia durata custom
- `setGuests(delta)` — aggiunge/rimuove guest pass
- `renderFriendSelection()` — aggiorna friend row e invite modal
- `updateSlotAvailability()` — verifica slot occupati/bloccati

### Accesso fisico
- `bindAccessFlow()` — bind eventi su step accesso
- `moveAccessStep(delta)` — naviga step cassaforte/serranda/porta/inside
- `revealAccessCode(show)` — mostra/nasconde codice cassaforte (hold)
- `openKeyConfirm()` — conferma chiave presa
- `confirmShutter()` — conferma serranda alzata
- `openNFC()` / `openCodeUnlock()` — apertura porta
- `openSafetyCheck()` — check corrente room
- `extendActiveSession()` — POST /api/bookings/:id/extend
- `applyBookingToAccess(booking)` — applica booking ai campi accesso
- `updateAccessAvailabilityUI()` — UI live/waiting
- `openBookingAccess(id)` — fetch booking e apri accesso

### Dashboard
- `loadDashboardData()` — GET /api/dashboard, popola next session, history, insights
- `loadPlatformFriends()` — GET /api/friends/platform

### Shop / Addons
- `renderShopAddons()` — renderizza griglia addon per categoria
- `addToCart(btn, name, price, id)` — aggiunge al carrello
- `removeFromCart(index)` — rimuove da carrello
- `checkoutCart()` — POST /api/addon-orders
- `updateCartUI()` — aggiorna totale e badge cart
- `updateShopSessionContext()` — contestualizza shop con booking attivo

### Admin
- `loadAdminSummary()` — GET /api/admin/summary, popola tutto il pannello admin
- `renderAdminBookings()` — tabella prenotazioni paginata
- `renderAdminUsers(users)` — lista utenti con form edit
- `renderAdminOps(data)` — accessi, addons, ordini, audit log
- `saveAdminBooking(id)` / `saveAdminUser(id)` / `saveAdminConfig()`
- `adjustUserChips(id, amount)` — PATCH chips
- `blockAdminSlot()` / `deleteBlockedSlot(id)`
- `createAdminAddon()` / `saveAdminAddon(id)` / `deleteAdminAddon(id)`

### Motion / Animazioni
- `initPremiumMotion()` — inizializza GSAP + ScrollTrigger
- `refreshPremiumMotion(resetScroll)` — aggiorna triggers per pagina attiva
- `initCinematicHero(activePage)` — hero GSAP animation
- `initParallax(activePage)` — parallax su sezioni
- `bindMagneticCards()` — effetto magnetico su .motion-card
- `stabilizeMobileMotion()` — kill GSAP su mobile
- `initLandingFullpage()` / `destroyLandingFullpage()` — fullpage desktop
- `setLandingSection(index, animated)` — scroll sezione fullpage
- `initHeroCarousel()` / `setHeroSlide(index, manual)` — carousel hero
- `initAnimatedFavicon()` — favicon animata canvas

### Utilities
- `api(path, options)` — fetch wrapper con credentials+json
- `showToast(options)` / `hideToast()` — toast notifiche
- `openModal(id)` / `closeModal(id)` — modali overlay
- `burstConfetti(n)` — confetti animati canvas
- `formatLocalDate(date)` / `formatLocalTime(date)`
- `bookingIsLive(booking)` / `bookingIsUpcoming(booking)` / `bookingSortValue(booking)`
- `hasActiveSession()` / `hasLiveSession()` / `hasShopAccess()`
- `openLegalDoc(type)` — legge e mostra documenti .docx via Mammoth

---

## 5. SEZIONI HTML (`index.html` — 1599 righe)

### Layout globale
- `#boot-loader` — splash screen iniziale
- `#auth-screen` — schermo login/register (hidden di default)
- `.page-switcher` — switcher pagine debug
- `.mobile-bottom-nav` — nav mobile 4 tab
- `#live-session-fab` — FAB sessione live
- `.roomie-nav` — navbar top
- `#app-subbar` — subbar con back/titolo
- `#side-menu` — drawer laterale

### Pagine (9 pagine SPA)
1. `#page-home` — Landing: hero carousel, inside tabs, regole, how-it-works
2. `#page-room` — Booking: room card, form 4-step (sessione/quando/gruppo/riepilogo)
3. `#page-token` — Chips wallet: saldo, ricarica, uso chips, ristoranti partner
4. `#page-checkout` — Checkout: riepilogo ordine, paga con chips, Stripe topup
5. `#page-confirm` — Accesso: conferma + arrival mode + access flow 5-step
6. `#page-session` — Sessione live: timer, sicurezza, cam, shop quick
7. `#page-shop` — Shop addon: featured/modes/snacks, cart sticky
8. `#page-dashboard` — Dashboard: next session, history, insights, camera card
9. `#page-admin` — Admin: summary, bookings, users, addons, config, ops

### Modali overlay
- `#modal-invite` — Aggiungi amici (platform + guest)
- `#modal-nfc` — ROOMIE Chip NFC
- `#modal-door-code` — Codice porta
- `#modal-safety` — Safety check corrente
- `#modal-key-confirm` — Conferma chiave serranda
- `#modal-token` — Ricarica chips
- `#modal-post-auth` — Post-auth wow modal
- `#modal-legal` — Documenti legali (Mammoth reader)
- `#modal-extend` — Estendi sessione

### Drawer
- `#side-menu` — Menu laterale con navigazione, profilo, logout

---

## 6. ASSET

### Immagini (`/public/assets/images/`)
| File | Uso |
|------|-----|
| `roomie-hero-slide-1.webp` | Hero slide 1 |
| `roomie-hero-slide-2.webp` | Hero slide 2 |
| `roomie-hero-slide-3.webp` | Hero slide 3 |
| `roomie-real-2.webp` | Unused / preview |
| `roomie-real-3.webp` | Room header card (page-room) |
| `ROOMIE-Launch-Keynote.pptx` | Asset marketing (non servito come web asset) |

### SEO (`/public/assets/seo/`)
| File | Uso |
|------|-----|
| `roomie-og.jpg` | OG image (1200×630) |
| `roomie-og.webp` | OG image webp |

### CSS
| File | Uso |
|------|-----|
| `roomie.css` | CSS principale (2146 righe) — custom identity, chip 3D, animazioni, hero, layout |

### JS
| File | Uso |
|------|-----|
| `roomie.js` | Logica client (3285 righe) |

### Legal (`/public/legal/`)
| File | Uso |
|------|-----|
| `termini-condizioni-roomie.docx` | Termini e Condizioni (letto via Mammoth) |
| `privacy-policy-roomie.docx` | Privacy Policy |
| `cookie-policy-roomie.docx` | Cookie Policy |

### CDN esterni
| Lib | Versione | Uso |
|-----|----------|-----|
| Bootstrap CSS | 5.3.3 | Layout, componenti base |
| GSAP | 3.12.5 | Animazioni premium |
| ScrollTrigger | 3.12.5 | Trigger scroll GSAP |
| Lenis | 1.1.20 | Smooth scroll (non usato attivamente, incluso) |
| FontAwesome Pro | 5.15.3 | Icone |
| Google Fonts | – | Bebas Neue, Barlow, Barlow Condensed, JetBrains Mono |
| Mammoth | 1.8.0 | Lettura .docx per documenti legali |

---

## 7. VARIABILI AMBIENTE RICHIESTE

| Var | Required | Note |
|-----|----------|------|
| `DATABASE_URL` | ✅ prod | Neon PostgreSQL connection string |
| `POSTGRES_URL` | alternativa | Vercel Postgres |
| `POSTGRES_PRISMA_URL` | alternativa | Vercel Postgres Prisma |
| `STRIPE_SECRET_KEY` | ✅ prod | sk_live_* o sk_test_* |
| `STRIPE_PUBLISHABLE_KEY` | ✅ frontend | pk_live_* o pk_test_* |
| `STRIPE_WEBHOOK_SECRET` | ✅ prod | whsec_* |
| `GOOGLE_CLIENT_ID` | opz | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | opz | OAuth Google (solo code flow) |
| `ADMIN_PASSWORD` | opz | Bootstrap admin account |
| `ADMIN_PASSWORD_HASH` | opz | Alternativa a ADMIN_PASSWORD |
| `ADMIN_USERNAME` | opz | Username admin (default: admin) |
| `ADMIN_NAME` | opz | Nome admin (default: ROOMIE Admin) |
| `SESSION_SECRET` | ✅ prod | HMAC per cookie sessione firmati |
| `APP_URL` | opz | URL base app (es. https://roomie.rilio.it) |
| `PORT` | opz | Porta (default 3000) |
| `NODE_ENV` | opz | production per cookie secure |
| `VERCEL` | auto | Set da Vercel, abilita Postgres e disabilita local-json |

---

## 8. DIPENDENZE BACKEND

```json
{
  "@neondatabase/serverless": "^1.1.0",
  "bcryptjs": "^3.0.3",
  "express": "^4.22.2",
  "stripe": "^22.1.1"
}
```

**Sostituzione in Next.js:**
- `express` → rimosso (Next API routes)
- `@neondatabase/serverless` → mantenuto identico
- `bcryptjs` → mantenuto identico
- `stripe` → mantenuto identico

---

## 9. RISCHI DEL PORTING

| Rischio | Livello | Nota |
|---------|---------|------|
| Session cookie custom (HMAC firmato) | 🟡 Medio | Portare `signPayload`/`verifyPayload` in `lib/session.ts` — Next.js non ha `req.session` nativo |
| Stripe webhook (`express.raw`) | 🟡 Medio | Next.js richiede `config.api.bodyParser = false` per raw body |
| GSAP + fullpage su SPA | 🟡 Medio | Init GSAP su client-side solo, no SSR |
| `roomie.js` globale 3285 righe | 🟡 Medio | Caricare come `<Script strategy="beforeInteractive">` inizialmente, refactor dopo |
| Google OAuth callback HTML bridge | 🟡 Medio | La route `/api/auth/google/callback` serve HTML + script, Next.js risponde con `new Response(html)` |
| Mammoth.js (lettura .docx) | 🟢 Basso | Solo client-side, CDN, nessun cambio |
| Local JSON fallback | 🟢 Basso | Rimane in `lib/db.ts` con stessa logica |
| `crypto.randomInt` / `crypto.randomUUID` | 🟢 Basso | Disponibili in Node 18+ / Edge runtime |
| Static assets | 🟢 Basso | Copiare tutto in `public/` di Next.js |
| Legal .docx files | 🟢 Basso | Copiare in `public/legal/` |

---

## 10. ORDINE CONSIGLIATO DI MIGRAZIONE

```
STEP 0  Audit (questo documento) ✅
STEP 1  Setup Next.js in roomie-2 + copia assets
STEP 2  Porting statico HTML → page.tsx (1:1)
STEP 3  Porting roomie.js come script client (quasi invariato)
STEP 4  Porting API routes Express → Next.js /api/
STEP 5  Database: portare lib/db.ts (Neon + local-json fallback)
STEP 6  Stripe: webhook + checkout + success
STEP 7  Auth: session HMAC + Google OAuth
STEP 8  Componentizzazione React (dopo equivalenza visiva)
STEP 9  TypeScript, env validation, best practice invisibili
STEP 10 Checklist verifica finale
```

**Milestone critica:** dopo STEP 3, la homepage Next deve essere visivamente identica all'originale.  
**Milestone go/no-go:** dopo STEP 7, tutte le API devono rispondere come l'originale.
