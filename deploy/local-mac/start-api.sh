#!/usr/bin/env bash
# Runs the Go API with environment from ~/.config/thuvien/env (override with THUVIEN_ENV).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
set -a; . "${THUVIEN_ENV:-$HOME/.config/thuvien/env}"; set +a
mkdir -p "$HOME/Library/Logs/thuvien"
cd "$ROOT/backend"
go build -o bin/api ./cmd/api
exec ./bin/api >> "$HOME/Library/Logs/thuvien/api.log" 2>&1
