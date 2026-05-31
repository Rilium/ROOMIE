#!/bin/bash
# ── setup-vercel.sh ────────────────────────────────────────────────────────────
# Imposta env vars e deploya su Vercel (progetto già linkato con `vercel link`).
# Esegui da roomie-2/:  bash scripts/setup-vercel.sh
# ──────────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")/.."

DATABASE_URL="postgresql://neondb_owner:npg_MlY6dVRSpkU8@ep-billowing-voice-aqardtsi-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
SESSION_SECRET="$(openssl rand -hex 32)"

echo ""
echo "⚡ ROOMIE-2 — Vercel env + deploy"
echo "──────────────────────────────────"
echo ""

# ── Env vars obbligatorie ─────────────────────────────────────────────────────
echo "→ Carico DATABASE_URL e SESSION_SECRET..."
printf '%s' "$DATABASE_URL"   | vercel env add DATABASE_URL   production --force 2>/dev/null || \
printf '%s' "$DATABASE_URL"   | vercel env add DATABASE_URL   production
printf '%s' "$SESSION_SECRET" | vercel env add SESSION_SECRET production --force 2>/dev/null || \
printf '%s' "$SESSION_SECRET" | vercel env add SESSION_SECRET production
echo "  ✓"

# ── Stripe (opzionale) ────────────────────────────────────────────────────────
echo ""
echo "Chiavi Stripe test? (invio per saltare)"
read -r -p "  sk_test_... : " STRIPE_SECRET
read -r -p "  pk_test_... : " STRIPE_PUB
read -r -p "  whsec_...   : " STRIPE_WEBHOOK

if [[ -n "$STRIPE_SECRET" ]]; then
  printf '%s' "$STRIPE_SECRET"  | vercel env add STRIPE_SECRET_KEY      production --force 2>/dev/null || printf '%s' "$STRIPE_SECRET"  | vercel env add STRIPE_SECRET_KEY      production
  printf '%s' "$STRIPE_PUB"     | vercel env add STRIPE_PUBLISHABLE_KEY production --force 2>/dev/null || printf '%s' "$STRIPE_PUB"     | vercel env add STRIPE_PUBLISHABLE_KEY production
  printf '%s' "$STRIPE_WEBHOOK" | vercel env add STRIPE_WEBHOOK_SECRET  production --force 2>/dev/null || printf '%s' "$STRIPE_WEBHOOK" | vercel env add STRIPE_WEBHOOK_SECRET  production
  echo "  ✓ Stripe"
else
  echo "  ↷ Stripe saltato"
fi

# ── Google OAuth (opzionale) ──────────────────────────────────────────────────
echo ""
read -r -p "Google Client ID (invio per saltare): " GOOGLE_ID
read -r -p "Google Client Secret:                 " GOOGLE_SECRET

if [[ -n "$GOOGLE_ID" ]]; then
  printf '%s' "$GOOGLE_ID"     | vercel env add GOOGLE_CLIENT_ID     production --force 2>/dev/null || printf '%s' "$GOOGLE_ID"     | vercel env add GOOGLE_CLIENT_ID     production
  printf '%s' "$GOOGLE_SECRET" | vercel env add GOOGLE_CLIENT_SECRET production --force 2>/dev/null || printf '%s' "$GOOGLE_SECRET" | vercel env add GOOGLE_CLIENT_SECRET production
  echo "  ✓ Google OAuth"
else
  echo "  ↷ Google OAuth saltato"
fi

# ── Deploy ────────────────────────────────────────────────────────────────────
echo ""
echo "→ Deploy..."
DEPLOY_OUT=$(vercel --yes 2>&1)
DEPLOY_URL=$(echo "$DEPLOY_OUT" | grep -Eo 'https://[a-zA-Z0-9._-]+\.vercel\.app' | tail -1)
echo "$DEPLOY_OUT" | tail -5

# ── APP_URL ───────────────────────────────────────────────────────────────────
if [[ -n "$DEPLOY_URL" ]]; then
  printf '%s' "$DEPLOY_URL" | vercel env add APP_URL production --force 2>/dev/null || \
  printf '%s' "$DEPLOY_URL" | vercel env add APP_URL production
  echo ""
  echo "→ Rideploy con APP_URL=$DEPLOY_URL..."
  vercel --yes 2>&1 | tail -3
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅  ROOMIE-2 online!                    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  URL → $DEPLOY_URL"
echo ""
echo "Se usi Google OAuth aggiungi questo redirect URI:"
echo "  $DEPLOY_URL/api/auth/google/callback"
