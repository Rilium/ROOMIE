---
title: "ROOMIE — Documentazione Tecnica e Operativa"
subtitle: "Applicazione di prenotazione sala Via Terni — Next.js + Neon PostgreSQL"
date: "Giugno 2026"
lang: it
---

> **Nota.** Questo documento descrive lo stato reale del codice del repository `roomie-2`
> al momento della stesura. Tutte le tabelle, gli endpoint e i flussi sono ricavati
> direttamente dal codice sorgente. La sezione finale *"Problemi noti"* elenca i difetti
> realmente presenti, da non confondere con funzionalità.

---

# Parte 1 — Documentazione Tecnica (per sviluppatori)

## 1. Panoramica dell'architettura

ROOMIE è una web app per la prenotazione di una sala gaming/intrattenimento ("Via Terni")
con un portafoglio interno a **chips** (gettoni prepagati). L'applicazione è costruita come
**Single Page Application** servita da Next.js.

| Aspetto | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + TypeScript |
| Database | Neon PostgreSQL (driver serverless HTTP `@neondatabase/serverless`) |
| Pagamenti | Stripe Checkout + Webhook |
| Login social | Google OAuth 2.0 (Authorization Code flow) |
| Hashing password | bcryptjs |
| Hosting | Vercel (region `cdg1` — Parigi) |
| Dominio produzione | `roomie.rilio.it` |

**Caratteristiche architetturali rilevanti:**

- **SPA dentro Next.js:** un'unica route client (`app/page.tsx`) mostra la pagina attiva
  in base allo stato `activePage` del context React, non al routing di Next. La navigazione
  tra "pagine" (home, room, token, confirm, session, shop, dashboard, admin) avviene in memoria.
- **Bridge legacy:** è presente un livello di compatibilità con il vecchio file
  `public/assets/js/roomie.js` tramite oggetti globali `window.__roomie_*`.
- **Operazioni atomiche via CTE:** il driver HTTP di Neon **non** supporta le callback
  asincrone in `.transaction()`. Tutte le operazioni che muovono chips (prenotazioni, addon,
  estensioni, ricariche) usano **una sola query con CTE data-modifying**, che in PostgreSQL
  è atomica.

## 2. Stack e dipendenze

Da `package.json`:

| Dipendenza | Versione | Uso |
|---|---|---|
| `next` | ^15.3.6 | Framework |
| `react` / `react-dom` | ^19.0.0 | UI |
| `@neondatabase/serverless` | ^1.1.0 | Client PostgreSQL |
| `bcryptjs` | ^3.0.3 | Hash password |
| `stripe` | ^22.1.1 | Pagamenti |

**Script disponibili:**

| Comando | Azione |
|---|---|
| `npm run dev` | Avvio sviluppo |
| `npm run build` | Build produzione |
| `npm run start` | Avvio produzione |
| `npm run lint` | ESLint |
| `npm run check` | `tsc --noEmit` (type check) |
| `npm run db:migrate` | Applica le migrazioni SQL al database (`db/migrate.ts`) |

## 3. Struttura delle cartelle

```
roomie-2/
├── app/
│   ├── api/                  # Route handler (backend)
│   │   ├── auth/             # login, register, logout, google, apple
│   │   ├── bookings/         # prenotazioni + price + extend
│   │   ├── addon-orders/     # ordini addon
│   │   ├── addons/           # listino addon pubblico
│   │   ├── stripe/           # topup-checkout, success, webhook
│   │   ├── wallet/           # topup (disattivato)
│   │   ├── admin/            # endpoint pannello admin
│   │   ├── app/config        # config pubblica
│   │   ├── dashboard, me     # dati utente
│   │   ├── friends/platform  # elenco utenti
│   │   └── health/           # diagnostica storage/payments/oauth
│   ├── components/           # componenti React (FE)
│   ├── context/AppContext.tsx# stato globale SPA
│   ├── page.tsx              # router SPA
│   └── layout.tsx            # layout root
├── lib/
│   ├── neon-db.ts            # layer dati (unica fonte di verità DB)
│   ├── api-helpers.ts        # guardie auth/CSRF/storage
│   ├── session.ts            # cookie di sessione firmati HMAC
│   ├── client-api.ts         # wrapper fetch lato client
│   ├── utils.ts              # funzioni pure (prezzi, date, validazioni)
│   └── types.ts              # contratti TypeScript
├── db/
│   ├── 001_initial_schema.sql
│   ├── 002_audit_log.sql
│   └── migrate.ts            # esegue tutte le migrazioni numerate
├── public/assets/            # CSS/JS legacy (roomie.js, roomie.css)
├── next.config.ts            # redirect + security headers
└── vercel.json               # config deploy
```

## 4. Database (Neon PostgreSQL)

### 4.1 Connessione

La funzione `getDb()` in `lib/neon-db.ts` apre la connessione leggendo la prima variabile
disponibile tra `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`. Se nessuna è
configurata lancia `DATABASE_URL is not set`.

### 4.2 Estensioni

- `pgcrypto` → `gen_random_uuid()`
- `citext` → testo case-insensitive per email/username

### 4.3 Tabelle

#### `users`
| Colonna | Tipo | Note |
|---|---|---|
| id | TEXT PK | default `gen_random_uuid()::text` |
| username | CITEXT | UNIQUE, NOT NULL |
| email | CITEXT | UNIQUE, NOT NULL |
| name | TEXT | NOT NULL |
| role | TEXT | `user` \| `admin` (default `user`) |
| chips | INTEGER | ≥ 0 (default 0) |
| password_hash | TEXT | NULL per account solo-OAuth |
| suspended | BOOLEAN | default FALSE |
| provider | TEXT | `google` \| `apple` \| NULL |
| provider_id | TEXT | subject OAuth |
| avatar | TEXT | URL avatar |
| created_at / updated_at | TIMESTAMPTZ | trigger su update |

#### `config` (riga singola, id = 1)
| Colonna | Tipo | Default |
|---|---|---|
| hourly_price | INTEGER | 12 |
| day_price | INTEGER | 60 |
| guest_pass_price | INTEGER | 2 |
| max_people | INTEGER | 8 |
| lockbox_code | TEXT | '0000' |
| door_code | TEXT | '0000' |

#### `bookings`
| Colonna | Tipo | Note |
|---|---|---|
| id | TEXT PK | |
| user_id | TEXT FK→users | ON DELETE CASCADE |
| room | TEXT | default 'Via Terni' |
| date | DATE | |
| start_time / end_time | TIME | |
| people | INTEGER | 1–20 |
| preset | TEXT | default 'ranked' |
| duration_hours | NUMERIC(4,1) | |
| guests | INTEGER | ≥ 0 |
| total_chips | INTEGER | ≥ 0 |
| status | TEXT | `confirmed`\|`pending`\|`completed`\|`cancelled` |
| live_mode | BOOLEAN | |
| lockbox_code / door_code | TEXT | codici accesso |
| access_valid_from / access_valid_until | TIMESTAMPTZ | finestra accesso |
| created_at / updated_at | TIMESTAMPTZ | |

Indici: `user_id`, `date`, `status`, `(date, start_time)`.

#### `wallet_transactions`
| Colonna | Tipo | Note |
|---|---|---|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| type | TEXT | `topup`\|`booking_debit`\|`addon_debit`\|`refund`\|`admin_adjustment`\|`cashback` |
| chips_delta | INTEGER | + credito / − addebito |
| chips_after | INTEGER | saldo dopo la transazione |
| ref_id | TEXT | id prenotazione/ordine/sessione Stripe |
| note | TEXT | |
| created_at | TIMESTAMPTZ | |

#### `addons`
| Colonna | Tipo | Note |
|---|---|---|
| id | TEXT PK | es. `dazn`, `pizza` |
| category | TEXT | `featured`\|`modes`\|`snacks` |
| brand / name / description | TEXT | |
| price | INTEGER | ≥ 0 |
| status | TEXT | `active`\|`soldout`\|`hidden`\|`deleted` |
| sold_today | INTEGER | contatore giornaliero |
| sold_today_date | DATE | data del contatore (reset automatico) |
| sort_order | INTEGER | ordinamento |

Il database viene pre-popolato con 8 addon di default (DAZN, Cinema, Mood Horror,
Gaming Pro, Neon Party, Pizza, Birra, Snack Box).

#### `addon_orders` / `addon_order_items`
Ordini di addon legati a una prenotazione, con righe dettaglio (`addon_id`, `qty`, `unit_price`, `total`).

#### `blocked_slots`
Fasce orarie bloccate dall'admin (data, start, end, motivo, creato_da).

#### `access_logs`
Eventi di accesso fisico (lockbox, porta, sessione). *Vedi "Problemi noti".*

#### `stripe_sessions`
| Colonna | Tipo | Note |
|---|---|---|
| id | TEXT PK | id sessione Stripe Checkout |
| user_id | TEXT FK→users | |
| amount_chips | INTEGER | chips da accreditare |
| amount_eur | NUMERIC(10,2) | importo pagato |
| status | TEXT | `pending`\|`paid`\|`already`\|`cancelled`\|`error` |
| payment_intent | TEXT | |
| paid_at | TIMESTAMPTZ | |

#### `audit_log`
Log applicativo (chi ha fatto cosa): `type`, `user_id`, `details` (JSONB), `created_at`.

#### `rate_limits`
Contatore tentativi per il rate limiting condiviso: `key` PK, `count`, `expires_at`.

### 4.4 Trigger

Funzione `set_updated_at()` collegata in `BEFORE UPDATE` a `users`, `bookings`, `addons`
per aggiornare automaticamente `updated_at`.

### 4.5 Migrazioni & bootstrap

- `db/migrate.ts` (`npm run db:migrate`) applica **in ordine** tutti i file `NNN_*.sql`
  della cartella `db/` (attualmente `001_initial_schema.sql` e `002_audit_log.sql`).
- `ensureBootstrapData()` in `lib/neon-db.ts` viene chiamata a ogni primo accesso e, in modo
  idempotente: esegue `ALTER TABLE addons ADD COLUMN IF NOT EXISTS sold_today_date`,
  crea `rate_limits` e `audit_log` se mancano, inserisce la riga `config`, gli addon di
  default e (se sono presenti `ADMIN_PASSWORD`/`ADMIN_PASSWORD_HASH`) l'utente admin.

## 5. Layer dati (`lib/neon-db.ts`)

Unica fonte di verità per l'accesso al DB. Funzioni principali:

- **Atomiche (CTE singola):**
  - `createBookingAtomic` — addebita chips (con controllo saldo) + registra transazione + crea prenotazione.
  - `createAddonOrderAtomic` — addebita chips + transazione + ordine + righe + aggiorna `sold_today` (usa `jsonb_to_recordset`).
  - `extendBookingAtomic` — addebita chips + transazione + estende `end_time`.
  - `creditStripeCheckoutSession` — segna sessione `paid` + accredita chips + transazione (idempotente su `status='pending'`).
  - `adjustUserChipsWithTransaction` — aggiustamento admin con transazione registrata.
- **Conflitti:** `hasBookingConflictNeon` confronta intervalli come timestamp e gestisce le
  fasce che attraversano la mezzanotte (controlla sia `bookings` sia `blocked_slots`).
- **Rate limiting:** `isRateLimited(key, max, windowMs)` / `clearRateLimit(key)` su tabella `rate_limits`.
- **Audit:** `logEvent(type, userId, details)` — scrive su `audit_log`, logga l'errore su console se l'insert fallisce.

## 6. Autenticazione e sessione

- **Cookie di sessione** `roomie.auth`: payload firmato con **HMAC SHA-256** (`lib/session.ts`),
  verificato con `timingSafeEqual`. Flag `HttpOnly`, `SameSite=Lax`, `Secure` in produzione.
  Scadenza 12h (o 30 giorni con "ricordami").
- **`SESSION_SECRET`** è obbligatorio in produzione (in mancanza l'app lancia un errore).
- **Guardie** (`lib/api-helpers.ts`): `requireAuth` (utente valido e non sospeso),
  `requireAdmin` (in più `role='admin'`).
- **Rate limiting** su login (max 8/min) e registrazione (max 5/min), per chiave `IP:identità`,
  ora persistito su DB (valido tra più istanze serverless).
- **Blocco password admin di default:** in produzione il login admin con password `admin` è rifiutato.

## 7. Sicurezza

- **CSRF:** schema double-submit. Il cookie `roomie.csrf` deve combaciare con l'header
  `X-ROOMIE-CSRF` su tutti i metodi non sicuri (POST/PATCH/PUT/DELETE), più verifica
  dell'header `Origin` contro l'host atteso / `APP_URL` (`csrfGuard`).
- **Security headers** (`next.config.ts`): `Strict-Transport-Security`, `X-Frame-Options: DENY`,
  `Content-Security-Policy`.
- **Password** salvate solo come hash bcrypt; mai restituite al client (`publicUser` filtra i campi).
- **Prezzi server-side:** il valore di prezzo inviato dal client è ignorato; il backend ricalcola
  sempre con `calcBookingPrice`.

## 8. Riferimento API

Legenda autenticazione: **Pubblico** = nessuna · **Auth** = utente loggato · **Admin** = ruolo admin.
Tutti gli endpoint mutanti richiedono token CSRF.

### Autenticazione
| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| POST | `/api/auth/register` | Pubblico | Registrazione (name, username, email, password ≥ 8). Crea utente con 24 chips di benvenuto. |
| POST | `/api/auth/login` | Pubblico | Login per username o email. |
| POST | `/api/auth/logout` | Auth | Logout (cancella cookie). |
| GET | `/api/auth/google` | Pubblico | Avvio OAuth Google (redirect). |
| GET | `/api/auth/google/callback` | Pubblico | Callback OAuth (scambio code→token, upsert utente). |
| GET | `/api/auth/apple` | Pubblico | Placeholder: ritorna `APPLE_NOT_CONFIGURED`. |

### Utente / App
| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/api/me` | Auth (soft) | Utente corrente o `{user:null}`. |
| GET | `/api/dashboard` | Auth | Riepilogo dashboard (prenotazioni, statistiche, consigli). |
| GET | `/api/app/config` | Pubblico | Config pubblica + slot bloccati + slot prenotati (lockbox **oscurato**). |
| GET | `/api/friends/platform` | Auth | Elenco altri utenti (username/nome/iniziali). |

### Prenotazioni
| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/api/bookings` | Auth | Le proprie prenotazioni (tutte se admin). |
| POST | `/api/bookings` | Auth | Crea prenotazione (prezzo ricalcolato server-side, addebito atomico). |
| GET | `/api/bookings/price` | Pubblico | Prezzo canonico per preset/durata/ospiti. |
| POST | `/api/bookings/[id]/extend` | Auth | Estende la prenotazione (1–4h; admin gratis). |

### Addon
| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/api/addons` | Pubblico | Listino addon attivi. |
| POST | `/api/addon-orders` | Auth | Ordine addon su prenotazione **live** (addebito atomico). |

### Wallet / Stripe
| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| POST | `/api/stripe/topup-checkout` | Auth | Crea sessione Stripe Checkout (1–500 chips). |
| GET | `/api/stripe/success` | Auth | Ritorno post-pagamento; tenta l'accredito. |
| POST | `/api/stripe/webhook` | Stripe (firma) | Evento `checkout.session.completed` → accredito. |
| POST | `/api/wallet/topup` | — | **Disattivato**: ritorna 410 (ricariche solo via Stripe). |

### Admin
| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/api/admin/summary` | Riepilogo completo (utenti, prenotazioni, ricavi, addon, audit). |
| PATCH | `/api/admin/config` | Aggiorna prezzi / max persone / lockbox. |
| PATCH | `/api/admin/users/[id]` | Aggiorna nome/email/ruolo/sospensione (con guardie anti auto-blocco). |
| PATCH | `/api/admin/users/[id]/chips` | Aggiustamento chips (con motivo obbligatorio, transazione registrata). |
| PATCH | `/api/admin/bookings/[id]` | Modifica prenotazione (data/orari/persone/stato/totale). |
| PATCH | `/api/admin/bookings/[id]/status` | Cambio stato prenotazione. |
| POST | `/api/admin/blocked-slots` | Crea slot bloccato. |
| DELETE | `/api/admin/blocked-slots/[id]` | Elimina slot bloccato. |
| POST | `/api/admin/addons` | Crea addon. |
| PATCH | `/api/admin/addons/[id]` | Modifica addon. |
| DELETE | `/api/admin/addons/[id]` | Elimina addon. |

### Health / diagnostica
| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/api/health/storage` | Stato DB + conteggio utenti/prenotazioni. |
| GET | `/api/health/payments` | Stato configurazione Stripe (chiavi presenti, modalità live/test). |
| GET | `/api/health/oauth` | Stato configurazione Google OAuth. |

## 9. Integrazione Stripe (ricariche chips)

Flusso previsto:

1. Il client chiama `POST /api/stripe/topup-checkout` con l'importo (1–500 chips).
2. Il backend crea una **Stripe Checkout Session** e restituisce l'URL di pagamento.
3. Dopo il pagamento Stripe richiama `POST /api/stripe/webhook`
   (`checkout.session.completed`) e/o l'utente torna su `GET /api/stripe/success`.
4. `creditStripeCheckoutSession()` segna la sessione come `paid` e accredita i chips in
   modo atomico. La condizione `status='pending'` garantisce l'**idempotenza**
   (un secondo accredito è no-op).

> ⚠️ **Vedi "Problemi noti" §14.1** — nello stato attuale del codice la riga `stripe_sessions`
> con stato `pending` non viene inserita, quindi l'accredito non avviene.

## 10. Integrazione Google OAuth

- `GET /api/auth/google` genera uno `state` casuale, lo salva in un cookie di sessione di
  breve durata e reindirizza ad Google (`response_type=code`, scope `openid email profile`).
- `GET /api/auth/google/callback` verifica lo `state`, scambia il `code` con i token
  (Authorization Code flow), recupera il profilo, crea/aggiorna l'utente
  (`upsertGoogleUserFromProfile`, 24 chips di benvenuto al primo accesso) e imposta la sessione.
- Apple login è solo un placeholder (non configurato).

## 11. Frontend

- **`app/page.tsx`** è il "router" SPA: in base ad `activePage` (dal context) renderizza il
  componente corretto (`LandingLegacy`, `BookingPage`, `TokenPage`, `ConfirmPage`,
  `SessionPage`, `ShopPage`, `DashboardPage`, `AdminPage`) più `Nav`, `Toast`, `Modals`.
- **`app/context/AppContext.tsx`** gestisce stato globale: utente, config, pagina attiva, auth,
  toast, bozza prenotazione, carrello, sessione attiva, modali. Contiene il bridge legacy
  `window.__roomie_*` verso `public/assets/js/roomie.js`.
- **`lib/client-api.ts`** è il wrapper `fetch` tipizzato: gestisce header CSRF automatici sui
  metodi mutanti e parsing degli errori.
- Compatibilità con CSS/JS legacy tramite classi sul `body` (`page-*`, `auth-logged-in/out`).

## 12. Deploy (Vercel)

- **`vercel.json`**: `version 2`, region `cdg1` (Parigi), commit GitHub silenziosi.
- **`next.config.ts`**: redirect `/ui-preview-v2.html → /`, security headers, `outputFileTracingRoot`.
- Dominio di produzione: `roomie.rilio.it`.

## 13. Variabili d'ambiente

| Variabile | Obbligatoria | Uso |
|---|---|---|
| `DATABASE_URL` (o `POSTGRES_URL` / `POSTGRES_PRISMA_URL`) | Sì | Connessione Neon |
| `SESSION_SECRET` | Sì (prod) | Firma cookie di sessione |
| `APP_URL` | Consigliata | Base URL per redirect/CSRF |
| `STRIPE_SECRET_KEY` | Per pagamenti | Chiave segreta Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Per pagamenti | Chiave pubblica Stripe |
| `STRIPE_WEBHOOK_SECRET` | Per webhook | Verifica firma webhook |
| `GOOGLE_CLIENT_ID` | Per login Google | OAuth |
| `GOOGLE_CLIENT_SECRET` | Per login Google | OAuth |
| `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_NAME` | Opzionali | Bootstrap admin |
| `ADMIN_PASSWORD` o `ADMIN_PASSWORD_HASH` | Per creare admin | Password admin iniziale |

> Le variabili contengono segreti: non vanno mai committate né incluse in questo documento con i loro valori.

## 14. Problemi noti (dallo stato attuale del codice)

> Questa sezione elenca difetti **realmente presenti**, utili a chi manutiene il progetto.

### 14.1 🔴 Le ricariche Stripe non accreditano i chips
`topup-checkout` crea la sessione Stripe ma non inserisce la riga `stripe_sessions` con stato
`pending`. Poiché `creditStripeCheckoutSession` accredita solo aggiornando una riga `pending`
esistente, l'accredito risulta sempre un no-op: l'utente paga ma non riceve chips.

### 14.2 🟡 Log di accesso fisico mai scritti
`logAccess()`/`listAccessLogs()` non hanno chiamanti: la tabella `access_logs` resta vuota,
pur essendo mostrata nel riepilogo admin.

### 14.3 🟡 Ricavo addon non calcolato
In `/api/admin/summary` il `addonRevenue` è fisso a 0 e `addonOrders` è sempre vuoto, pur
esistendo la tabella `addon_orders`.

### 14.4 🟡 Altri
- `/api/friends/platform` espone a ogni utente loggato l'elenco di tutti gli utenti.
- `/api/addons` non ha `storageGuard` (errore 500 invece di 503 se il DB non è configurato).
- La config admin accetta prezzi non interi (validato solo il range, non l'intero).
- Il `lockboxCode` finisce in chiaro in `audit_log` quando l'admin aggiorna la configurazione.
- `ensureBootstrapData` esegue DDL (`ALTER`/`CREATE IF NOT EXISTS`) a ogni cold start.
- Codice non utilizzato (footgun): helper non atomici `createBooking`, `createAddonOrder`,
  `adjustUserChips`, `recordTransaction`, `updateUserChips`, `createStripeSession`,
  `completeStripeSession`, `markStripeSessionAlready`.
- Residui di refactor: bridge `window.__roomie_*` ancora dentro `AppContext`; tipo
  `StripeSession` non più usato in `types.ts`.

---

# Parte 2 — Documentazione Operativa (per amministratori)

## 1. Cos'è ROOMIE

ROOMIE permette ai clienti di prenotare la sala "Via Terni", pagare con un portafoglio a
**chips** (gettoni prepagati), aggiungere extra ("addon": modalità, snack, servizi) e ricevere
i codici di accesso. L'amministratore gestisce prezzi, prenotazioni, utenti, chips, addon e
disponibilità.

## 2. Accesso al pannello admin

- Accedi con un account che ha **ruolo admin**.
- L'account admin viene creato automaticamente al primo avvio se sono impostate le credenziali
  amministrative (variabili `ADMIN_*`).
- In produzione **non è possibile** accedere come admin con la password `admin`: va impostata
  una password reale.
- Dopo il login, la sezione **Admin** è raggiungibile dalla navigazione.

## 3. Panoramica dashboard admin

La schermata admin mostra, in sintesi:

- **Ricavi** (in chips) generati dalle prenotazioni.
- **Numero di prenotazioni** totali e in attesa.
- **Utenti** registrati e **chips totali** nei portafogli.
- **Sessioni live** in corso.
- Elenco prenotazioni recenti con nome/username/email del cliente.
- Stato impianti (saracinesca, porta, codice lockbox, alimentazione).

## 4. Gestione prenotazioni

- Visualizzi tutte le prenotazioni con cliente, data, orario, persone, stato e totale chips.
- Puoi **modificare** una prenotazione (data, orari, sala, numero persone, stato) e, indicando
  un **motivo**, anche il totale chips.
- Puoi cambiare lo **stato**: `confirmed` (confermata), `pending` (in attesa),
  `completed` (completata), `cancelled` (annullata).
- Il sistema impedisce sovrapposizioni: se una fascia è già occupata o bloccata, la modifica
  che la rende "attiva" viene rifiutata.

## 5. Gestione utenti e chips

- Elenco utenti con possibilità di modificare **nome, email, ruolo** e **sospendere** un account.
- **Aggiustamento chips:** puoi aggiungere o togliere chips a un utente. È **obbligatorio**
  indicare un **motivo** (minimo 3 caratteri): viene registrato nello storico del portafoglio e
  nell'audit log. L'aggiustamento è limitato a ±500 per operazione.
- **Tutele:** non puoi sospendere te stesso né rimuovere a te stesso il ruolo admin.

## 6. Gestione addon

- Crea, modifica o elimina gli "addon" (extra) con categoria (`featured`, `modes`, `snacks`),
  marca, nome, descrizione, prezzo e stato (`active`, `soldout`, `hidden`, `deleted`).
- Il contatore "venduti oggi" si azzera automaticamente ogni giorno.

## 7. Slot bloccati (disponibilità)

- Puoi **bloccare** fasce orarie (data, ora inizio, ora fine, motivo) per impedire prenotazioni
  (manutenzione, eventi privati, ecc.).
- Gli slot bloccati sono considerati nel controllo conflitti insieme alle prenotazioni attive.

## 8. Configurazione prezzi e codici

Dalla sezione configurazione puoi impostare:

- **Prezzo orario** (chips/ora) — intervallo 1–250.
- **Prezzo giornata** (preset "full") — intervallo 1–2000.
- **Prezzo guest pass** (per ospite) — intervallo 0–100.
- **Massimo persone** — intervallo 1–30.
- **Codice lockbox** (4–6 cifre) per l'accesso fisico.

Il prezzo di una prenotazione è calcolato **dal server** secondo questi valori (il prezzo
mostrato dal client non viene mai considerato come fonte di verità).

## 9. Significato degli stati prenotazione

| Stato | Significato |
|---|---|
| `confirmed` | Prenotazione attiva e confermata. |
| `pending` | In attesa (es. da confermare). |
| `completed` | Sessione conclusa. |
| `cancelled` | Annullata (non occupa la fascia, non genera ricavo). |

## 10. Audit log

Ogni azione rilevante (login, registrazione, creazione/modifica prenotazione, aggiustamento
chips, modifica config, ecc.) viene registrata nell'**audit log** con tipo evento, utente,
dettagli e data. È consultabile dal riepilogo admin e serve per tracciabilità e controllo.

---

*Documento generato dall'analisi diretta del codice sorgente del repository `roomie-2`.*
