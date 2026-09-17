#!/usr/bin/env bash
# Runs the Cloudflare Tunnel connector for thuvien.vietsoftware.vn using the
# credentials-file tunnel "thuvien" (created via `cloudflared tunnel create thuvien`).
set -euo pipefail
mkdir -p "$HOME/Library/Logs/thuvien"
exec cloudflared tunnel --no-autoupdate --config "$HOME/.cloudflared/thuvien.yml" run thuvien >> "$HOME/Library/Logs/thuvien/tunnel.log" 2>&1
