#!/bin/bash
# ── vercel-env-setup.sh ────────────────────────────────────────────────────────
# Carica le env vars su Vercel per production + staging (preview).
# Runnare UNA SOLA VOLTA dopo `vercel link`.
#
# Uso:
#   chmod +x scripts/vercel-env-setup.sh
#   ./scripts/vercel-env-setup.sh
#
# Prerequisiti: vercel CLI loggato (`vercel login`)
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo ""
echo "⚡ ROOMIE — Vercel env setup"
echo "──────────────────────────────"
echo ""

# ── Valori da inserire ────────────────────────────────────────────────────────
# Modifica questi valori prima di runnare

DATABASE_URL_PROD="postgresql://neondb_owner:npg_MlY6dVRSpkU8@ep-billowing-voice-aqardtsi-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
DATABASE_URL_STAGING="$DATABASE_URL_PROD"  # stessa DB — crea una staging separata se vuoi

# ⚠️  CAMBIA QUESTI — genera con: openssl rand -hex 32
SESSION_SECRET_PROD="$(openssl rand -hex 32)"
SESSION_SECRET_STAGING="$(openssl rand -hex 32)"

# ⚠️  INSERISCI LE CHIAVI STRIPE REALI
STRIPE_SECRET_PROD="sk_live_..."           # Dashboard Stripe → Developers → API keys
STRIPE_SECRET_STAGING="sk_test_..."
STRIPE_WEBHOOK_SECRET_PROD="whsec_..."     # Dashboard Stripe → Webhooks → endpoint prod
STRIPE_WEBHOOK_SECRET_STAGING="whsec_..."  # Dashboard Stripe → Webhooks → endpoint staging
STRIPE_PUBLISHABLE_PROD="pk_live_..."
STRIPE_PUBLISHABLE_STAGING="pk_test_..."

# ⚠️  INSERISCI LE CREDENZIALI GOOGLE OAUTH
GOOGLE_CLIENT_ID="INSERISCI.apps.googleusercontent.com"   # console.cloud.google.com
GOOGLE_CLIENT_SECRET="GOCSPX-INSERISCI"

# ⚠️  Dopo il primo `vercel deploy`, copia qui l'URL auto-generato tipo:
# https://roomie-2-abc123.vercel.app
# e ri-esegui lo script (o aggiorna manualmente da Vercel Dashboard → Settings → Env Vars)
APP_URL_PROD="https://INSERISCI-URL-VERCEL.vercel.app"
APP_URL_STAGING="$APP_URL_PROD"

# ── Production ────────────────────────────────────────────────────────────────
echo "→ Carico env production..."

echo "$DATABASE_URL_PROD"         | vercel env add DATABASE_URL        production
echo "$SESSION_SECRET_PROD"       | vercel env add SESSION_SECRET      production
echo "$STRIPE_SECRET_PROD"        | vercel env add STRIPE_SECRET_KEY   production
echo "$STRIPE_WEBHOOK_SECRET_PROD"| vercel env add STRIPE_WEBHOOK_SECRET production
echo "$STRIPE_PUBLISHABLE_PROD"   | vercel env add STRIPE_PUBLISHABLE_KEY production
echo "$GOOGLE_CLIENT_ID"          | vercel env add GOOGLE_CLIENT_ID    production
echo "$GOOGLE_CLIENT_SECRET"      | vercel env add GOOGLE_CLIENT_SECRET production
echo "$APP_URL_PROD"              | vercel env add APP_URL             production

# ── Staging (preview branch = staging) ───────────────────────────────────────
echo "→ Carico env staging..."

echo "$DATABASE_URL_STAGING"         | vercel env add DATABASE_URL        preview staging
echo "$SESSION_SECRET_STAGING"       | vercel env add SESSION_SECRET      preview staging
echo "$STRIPE_SECRET_STAGING"        | vercel env add STRIPE_SECRET_KEY   preview staging
echo "$STRIPE_WEBHOOK_SECRET_STAGING"| vercel env add STRIPE_WEBHOOK_SECRET preview staging
echo "$STRIPE_PUBLISHABLE_STAGING"   | vercel env add STRIPE_PUBLISHABLE_KEY preview staging
echo "$GOOGLE_CLIENT_ID"             | vercel env add GOOGLE_CLIENT_ID    preview staging
echo "$GOOGLE_CLIENT_SECRET"         | vercel env add GOOGLE_CLIENT_SECRET preview staging
echo "$APP_URL_STAGING"              | vercel env add APP_URL             preview staging

echo ""
echo "✓ Env vars caricate."
echo ""
echo "Prossimi step:"
echo "  git checkout -b staging && git push origin staging"
echo "  vercel --prod   ← deploy production"
