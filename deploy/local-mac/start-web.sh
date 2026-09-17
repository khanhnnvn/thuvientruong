#!/usr/bin/env bash
# Runs the Next.js standalone build with environment from ~/.config/thuvien/env.
# Build first: cd frontend && pnpm build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
set -a; . "${THUVIEN_ENV:-$HOME/.config/thuvien/env}"; set +a
mkdir -p "$HOME/Library/Logs/thuvien"
cd "$ROOT/frontend"
exec node .next/standalone/server.js >> "$HOME/Library/Logs/thuvien/web.log" 2>&1
