#!/usr/bin/env bash
# Run on the server after `git pull`, from apps/dashboard.
#
# Next.js standalone output (`.next/standalone`) does NOT include
# `.next/static` or `public` — they have to be copied in by hand after
# every build, or every page loads unstyled with every asset 404ing
# (discovered live 2026-10-01 wiring the KYB review page: the page
# rendered, but with zero CSS/JS/fonts).
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile
npx next build

rm -rf .next/standalone/apps/dashboard/.next/static
cp -r .next/static .next/standalone/apps/dashboard/.next/static
if [ -d public ]; then
  rm -rf .next/standalone/apps/dashboard/public
  cp -r public .next/standalone/apps/dashboard/public
fi

pm2 restart logix-dashboard
echo "Deployed. Static assets copied into standalone output."
