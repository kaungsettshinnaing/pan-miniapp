#!/bin/bash
# Run once on a fresh Hostinger VPS (Ubuntu 22.04+)
# Usage: bash setup-vps.sh
set -euo pipefail

echo "=== PAN VPS Setup ==="

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$USER"
  echo "Docker installed. You may need to log out and back in for group changes."
fi

if ! docker compose version &>/dev/null; then
  echo "Docker Compose plugin not found — Docker install should have included it."
  exit 1
fi

# ── Nginx + Certbot ──────────────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
  echo "Installing nginx and certbot..."
  apt-get update -q
  apt-get install -y nginx certbot python3-certbot-nginx
fi

# ── UAT directory ─────────────────────────────────────────────────────────────
UAT_DIR=/opt/pan-miniapp-uat
PROD_DIR=/opt/pan-miniapp

for DIR in "$UAT_DIR" "$PROD_DIR"; do
  if [ ! -d "$DIR" ]; then
    mkdir -p "$DIR"
    echo "Created $DIR — clone your repo there:"
    echo "  git clone git@github.com:YOUR_ORG/pan-miniapp.git $DIR"
  else
    echo "$DIR already exists."
  fi
done

# ── Nginx config ──────────────────────────────────────────────────────────────
NGINX_CONF=/etc/nginx/sites-available/cashbackapp.conf
if [ ! -f "$NGINX_CONF" ]; then
  echo "Copying nginx config..."
  cp "$UAT_DIR/nginx/cashbackapp.conf" "$NGINX_CONF"
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/cashbackapp.conf
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  echo "Nginx configured."
fi

# ── SSL certificates ──────────────────────────────────────────────────────────
echo ""
echo "Next: obtain SSL certs (run after DNS A records point to this server):"
echo "  certbot --nginx -d uat.cashbackapp.cloud -d app.cashbackapp.cloud"
echo ""

# ── GitHub deploy key hint ────────────────────────────────────────────────────
if [ ! -f ~/.ssh/id_ed25519 ]; then
  echo "Generating SSH key for GitHub deploy access..."
  ssh-keygen -t ed25519 -C "pan-vps-deploy" -f ~/.ssh/id_ed25519 -N ""
  echo ""
  echo "Add this public key to your GitHub repo (Settings → Deploy keys):"
  cat ~/.ssh/id_ed25519.pub
  echo ""
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Checklist:"
echo "  1. Clone repo into $UAT_DIR and $PROD_DIR"
echo "  2. Copy env.example to .env.prod in each directory and fill in values"
echo "  3. Set DNS A records for uat.cashbackapp.cloud and app.cashbackapp.cloud to this VPS IP"
echo "  4. Run: certbot --nginx -d uat.cashbackapp.cloud -d app.cashbackapp.cloud"
echo "  5. In $UAT_DIR: docker compose -f docker-compose.prod.yml --env-file .env.prod up -d"
echo "  6. Run first migration: docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy"
echo "  7. (Optional) Seed: docker compose -f docker-compose.prod.yml exec app npx tsx prisma/seed.ts"
echo "  8. Add GitHub Actions secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY"
echo ""
