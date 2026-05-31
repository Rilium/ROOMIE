#!/bin/bash
# ── deploy.sh ─────────────────────────────────────────────────────────────────
# Script deploy completo ROOMIE → Vercel
# Esegui dal root del repo: bash roomie-2/scripts/deploy.sh
# ──────────────────────────────────────────────────────────────────────────────

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="$REPO_ROOT/roomie-2"

echo ""
echo "⚡ ROOMIE — Deploy Vercel"
echo "────────────────────────────"
echo ""

# ── 1. Git remote ─────────────────────────────────────────────────────────────
if ! git -C "$REPO_ROOT" remote get-url origin &>/dev/null; then
  echo "❌  Nessun git remote configurato."
  echo ""
  echo "Aggiungi il remote del tuo repo GitHub:"
  echo "  git remote add origin https://github.com/TUO-USER/ROOMIE.git"
  echo "  git push -u origin main"
  echo ""
  echo "Poi ri-esegui questo script."
  exit 1
fi

# ── 2. Push main ──────────────────────────────────────────────────────────────
echo "→ Push main..."
git -C "$REPO_ROOT" push origin main

# ── 3. Vercel CLI ─────────────────────────────────────────────────────────────
if ! command -v vercel &>/dev/null; then
  echo "→ Installo Vercel CLI..."
  npm install -g vercel
fi

# ── 4. Vercel link ────────────────────────────────────────────────────────────
echo ""
echo "→ Link progetto Vercel (segui le istruzioni interattive)..."
cd "$APP_DIR"
vercel link

# ── 5. Env vars ───────────────────────────────────────────────────────────────
echo ""
echo "→ Carico env vars..."
bash "$APP_DIR/scripts/vercel-env-setup.sh"

# ── 6. Branch staging ─────────────────────────────────────────────────────────
echo ""
echo "→ Creo branch staging..."
git -C "$REPO_ROOT" checkout -b staging 2>/dev/null || git -C "$REPO_ROOT" checkout staging
git -C "$REPO_ROOT" push origin staging

# ── 7. Deploy production ──────────────────────────────────────────────────────
echo ""
echo "→ Deploy production..."
cd "$APP_DIR"
vercel --prod

echo ""
echo "✅  Deploy completato."
echo ""
echo "URLs:"
echo "  Production : https://roomie.rilio.it"
echo "  Staging    : preview branch 'staging' su Vercel"
echo ""
echo "Prossimi step obbligatori:"
echo "  1. Google Console → aggiungi redirect URI staging"
echo "     https://staging.roomie.rilio.it/api/auth/google/callback"
echo "  2. Stripe Dashboard → aggiungi webhook staging"
echo "     https://staging.roomie.rilio.it/api/stripe/webhook"
