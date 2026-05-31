# CHECKLIST PORTING — ROOMIE Express → Next.js

> Stato: **✅ Porting completato**  
> Data: 2026-05-30  
> Sorgente: `/ROOMIE/` (Express monolith)  
> Target: `/ROOMIE/roomie-2/` (Next.js 15 App Router)

---

## Struttura progetto

| File / Directory | Stato | Note |
|---|---|---|
| `app/layout.tsx` | ✅ | Head, CDN, Script strategy corretti |
| `app/page.tsx` | ✅ | 1599 righe HTML → 1550 JSX, auto-convertito |
| `lib/types.ts` | ✅ | Tutti gli interface TypeScript dal server.js |
| `lib/session.ts` | ✅ | HMAC cookie identico, crypto pura |
| `lib/db.ts` | ✅ | readDb/writeDb + 25 helper functions |
| `lib/api-helpers.ts` | ✅ | requireAuth, requireAdmin, appBaseUrl, storageGuard |
| `next.config.ts` | ✅ | Redirect /ui-preview-v2.html → / |
| `package.json` | ✅ | Next.js 15.1.8, dependencies corrette |
| `tsconfig.json` | ✅ | Strict, @/* alias, bundler module |
| `.env.local.example` | ✅ | Tutti i 13 env var documentati |

---

## API Routes (32 file)

| Route Express originale | Route Next.js | Metodo | Stato |
|---|---|---|---|
| `POST /api/stripe/webhook` | `app/api/stripe/webhook/route.ts` | POST | ✅ |
| `POST /api/auth/login` | `app/api/auth/login/route.ts` | POST | ✅ |
| `POST /api/auth/register` | `app/api/auth/register/route.ts` | POST | ✅ |
| `POST /api/auth/logout` | `app/api/auth/logout/route.ts` | POST | ✅ |
| `GET /api/auth/google` | `app/api/auth/google/route.ts` | GET | ✅ |
| `GET /api/auth/google/callback` | `app/api/auth/google/callback/route.ts` | GET | ✅ |
| `POST /api/auth/google/token` | `app/api/auth/google/token/route.ts` | POST | ✅ |
| `GET /api/auth/apple` | `app/api/auth/apple/route.ts` | GET | ✅ |
| `GET /api/health/oauth` | `app/api/health/oauth/route.ts` | GET | ✅ |
| `GET /api/health/storage` | `app/api/health/storage/route.ts` | GET | ✅ |
| `GET /api/health/payments` | `app/api/health/payments/route.ts` | GET | ✅ |
| `GET /api/me` | `app/api/me/route.ts` | GET | ✅ |
| `GET /api/app/config` | `app/api/app/config/route.ts` | GET | ✅ |
| `GET /api/addons` | `app/api/addons/route.ts` | GET | ✅ |
| `POST /api/addon-orders` | `app/api/addon-orders/route.ts` | POST | ✅ |
| `GET /api/bookings` | `app/api/bookings/route.ts` | GET | ✅ |
| `POST /api/bookings` | `app/api/bookings/route.ts` | POST | ✅ |
| `POST /api/bookings/:id/extend` | `app/api/bookings/[id]/extend/route.ts` | POST | ✅ |
| `GET /api/dashboard` | `app/api/dashboard/route.ts` | GET | ✅ |
| `GET /api/friends/platform` | `app/api/friends/platform/route.ts` | GET | ✅ |
| `POST /api/wallet/topup` | `app/api/wallet/topup/route.ts` | POST | ✅ |
| `POST /api/stripe/topup-checkout` | `app/api/stripe/topup-checkout/route.ts` | POST | ✅ |
| `GET /api/stripe/success` | `app/api/stripe/success/route.ts` | GET | ✅ |
| `GET /api/admin/summary` | `app/api/admin/summary/route.ts` | GET | ✅ |
| `PATCH /api/admin/bookings/:id/status` | `app/api/admin/bookings/[id]/status/route.ts` | PATCH | ✅ |
| `PATCH /api/admin/bookings/:id` | `app/api/admin/bookings/[id]/route.ts` | PATCH | ✅ |
| `PATCH /api/admin/users/:id/chips` | `app/api/admin/users/[id]/chips/route.ts` | PATCH | ✅ |
| `PATCH /api/admin/users/:id` | `app/api/admin/users/[id]/route.ts` | PATCH | ✅ |
| `PATCH /api/admin/config` | `app/api/admin/config/route.ts` | PATCH | ✅ |
| `POST /api/admin/addons` | `app/api/admin/addons/route.ts` | POST | ✅ |
| `PATCH /api/admin/addons/:id` | `app/api/admin/addons/[id]/route.ts` | PATCH | ✅ |
| `DELETE /api/admin/addons/:id` | `app/api/admin/addons/[id]/route.ts` | DELETE | ✅ |
| `POST /api/admin/blocked-slots` | `app/api/admin/blocked-slots/route.ts` | POST | ✅ |
| `DELETE /api/admin/blocked-slots/:id` | `app/api/admin/blocked-slots/[id]/route.ts` | DELETE | ✅ |

**Non API** (gestiti da Next.js natively):
- `GET /` → `app/page.tsx`
- `GET /ui-preview-v2.html` → redirect in `next.config.ts`
- `GET /assets/**` → `public/` directory (serve statica)

---

## Static Assets

| Asset | Presente | Identico all'originale |
|---|---|---|
| `public/assets/css/roomie.css` | ✅ | ✅ diff pulito |
| `public/assets/js/roomie.js` | ✅ | ✅ diff pulito |
| `public/assets/images/*.webp` | ✅ | ✅ |
| `public/assets/seo/roomie-og.*` | ✅ | ✅ |
| `public/legal/*.docx` | ✅ | ✅ |

---

## Invarianti di sicurezza

| Requisito | Stato |
|---|---|
| Nessuna modifica alla cartella `/ROOMIE/` originale | ✅ |
| CSS identico (neon lime, chip 3D, animazioni) | ✅ |
| JS client identico (roomie.js non modificato) | ✅ |
| Logica sessione HMAC identica | ✅ |
| Logica DB identica (Neon + fallback JSON) | ✅ |
| Stripe checkout e webhook identici | ✅ |
| Google OAuth (implicit + code flow) identico | ✅ |
| Tutti i codici errore API identici | ✅ |

---

## Per avviare

```bash
cd roomie-2
cp .env.local.example .env.local
# Compila le variabili (DATABASE_URL, STRIPE_*, GOOGLE_*, SESSION_SECRET)
npm install
npm run dev        # → http://localhost:3000
npm run check      # TypeScript type check
npm run build      # Build produzione
```

## Deploy su Vercel

```bash
vercel --prod
# Environment variables da configurare nel dashboard Vercel:
# DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY,
# STRIPE_WEBHOOK_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
# SESSION_SECRET, APP_URL
```

---

## TODO post-deploy

- [ ] Verificare visivamente in browser su mobile e desktop
- [ ] Testare login/register/Google OAuth in produzione
- [ ] Verificare Stripe webhook con `stripe listen --forward-to`
- [ ] Controllare `GET /api/health/storage` → `configured: true`
- [ ] Controllare `GET /api/health/oauth` → chiavi valide
- [ ] Controllare `GET /api/health/payments` → mode: live/test
