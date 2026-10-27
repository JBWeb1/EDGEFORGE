#!/usr/bin/env bash
# One-time setup when the codespace is created: env file, dependencies,
# database schema and the demo account.
set -euo pipefail

if [ ! -f .env ]; then
  if [ -n "${CODESPACE_NAME:-}" ]; then
    APP_URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  else
    APP_URL="http://localhost:3000"
  fi
  cat > .env <<ENV
DATABASE_URL="postgresql://edgeforge:edgeforge@db:5432/edgeforge?schema=public"
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
BETTER_AUTH_URL="${APP_URL}"
ENV
  echo "Created .env for ${APP_URL}"
fi

npm ci
npx prisma migrate deploy
npm run seed:demo
echo
echo "EDGEFORGE is ready. The app starts automatically; sign in with demo@edgeforge.local / edgeforge-demo"
