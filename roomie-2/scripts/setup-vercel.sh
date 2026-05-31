#!/bin/bash
# ── setup-vercel.sh ────────────────────────────────────────────────────────────
# Crea progetto Vercel, carica env vars, fa il primo deploy.
# Esegui da roomie-2/:  bash scripts/setup-vercel.sh
# ──────────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")/.."

PROJECT_NAME="dev-roomie"
DATABASE_URL="postgresql://neondb_owner:npg_MlY6dVRSpkU8@ep-billowing-voice-aqardtsi-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
SESSION_SECRET="$(openssl rand -hex 32)"

echo ""
echo "⚡ ROOMIE-2 — Vercel setup"
echo "──────────────────────────────"
echo ""

# ── 1. Link progetto ──────────────────────────────────────────────────────────
echo "→ Creo/collego progetto '$PROJECT_NAME'..."
vercel link --project "$PROJECT_NAME" --yes 2>/dev/null || {
  echo "  (progetto non esiste, lo creo...)"
  vercel project add "$PROJECT_NAME"
  vercel link --project "$PROJECT_NAME" --yes
}
echo "  ✓ progetto collegato"
echo ""

# ── 2. Env vars obbligatorie ──────────────────────────────────────────────────
echo "→ Carico env vars obbligatorie (DATABASE_URL, SESSION_SECRET)..."
echo "$DATABASE_URL"  | vercel env add DATABASE_URL   production --force 2>/dev/null || \
echo "$DATABASE_URL"  | vercel env add DATABASE_URL   production
echo "$SESSION_SECRET"| vercel env add SESSION_SECRET production --force 2>/dev/null || \
echo "$SESSION_SECRET"| vercel env add SESSION_SECRET production
echo "  ✓ DB + session"
echo ""

# ── 3. Chiavi Stripe (opzionale per debug) ────────────────────────────────────
echo "Hai le chiavi Stripe test? (premi invio per saltare)"
read -r -p "  sk_test_... : " STRIPE_SECRET
read -r -p "  pk_test_... : " STRIPE_PUB
read -r -p "  whsec_...   : " STRIPE_WEBHOOK

if [[ -n "$STRIPE_SECRET" ]]; then
  echo "$STRIPE_SECRET" | vercel env add STRIPE_SECRET_KEY     production --force 2>/dev/null || \
  echo "$STRIPE_SECRET" | vercel env add STRIPE_SECRET_KEY     production
  echo "$STRIPE_PUB"    | vercel env add STRIPE_PUBLISHABLE_KEY production --force 2>/dev/null || \
  echo "$STRIPE_PUB"    | vercel env add STRIPE_PUBLISHABLE_KEY production
  echo "$STRIPE_WEBHOOK"| vercel env add STRIPE_WEBHOOK_SECRET  production --force 2>/dev/null || \
  echo "$STRIPE_WEBHOOK"| vercel env add STRIPE_WEBHOOK_SECRET  production
  echo "  ✓ Stripe"
else
  echo "  ↷ Stripe saltato (wallet topup non funzionerà)"
fi
echo ""

# ── 4. Google OAuth (opzionale per debug) ─────────────────────────────────────
read -r -p "Google Client ID (premi invio per saltare): " GOOGLE_ID
read -r -p "Google Client Secret: " GOOGLE_SECRET

if [[ -n "$GOOGLE_ID" ]]; then
  echo "$GOOGLE_ID"    | vercel env add GOOGLE_CLIENT_ID     production --force 2>/dev/null || \
  echo "$GOOGLE_ID"    | vercel env add GOOGLE_CLIENT_ID     production
  echo "$GOOGLE_SECRET"| vercel env add GOOGLE_CLIENT_SECRET production --force 2>/dev/null || \
  echo "$GOOGLE_SECRET"| vercel env add GOOGLE_CLIENT_SECRET production
  echo "  ✓ Google OAuth"
else
  echo "  ↷ Google OAuth saltato"
fi
echo ""

# ── 5. Primo deploy ───────────────────────────────────────────────────────────
echo "→ Deploy in corso..."
DEPLOY_URL=$(vercel --yes 2>&1 | grep -E "https://" | tail -1)
echo ""
echo "  ✓ Deploy completato"
echo ""

# ── 6. APP_URL ────────────────────────────────────────────────────────────────
if [[ -n "$DEPLOY_URL" ]]; then
  echo "$DEPLOY_URL" | vercel env add APP_URL production --force 2>/dev/null || \
  echo "$DEPLOY_URL" | vercel env add APP_URL production
  echo "  ✓ APP_URL impostato a $DEPLOY_URL"
  echo ""
  echo "→ Rideploy con APP_URL corretto..."
  vercel --yes
  echo ""
fi

echo "╔══════════════════════════════════════════╗"
echo "║  ✅  ROOMIE-2 deployato!                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "URL: $DEPLOY_URL"
echo ""
echo "Prossimo step se usi Google OAuth:"
echo "  Google Console → Authorized redirect URIs → aggiungi:"
echo "  $DEPLOY_URL/api/auth/google/callback"
