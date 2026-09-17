#!/usr/bin/env bash
# Daily backup: PostgreSQL dump. Keeps BACKUP_KEEP_DAYS of history.
# Run by ~/Library/LaunchAgents/com.thuvien.backup.plist, or by hand.
set -euo pipefail
set -a; . "${THUVIEN_ENV:-$HOME/.config/thuvien/env}"; set +a

DEST="${BACKUP_DIR:-$HOME/Backups/thuvien}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$DEST"

# -Fc is the compressed custom format; restore with: pg_restore -d thuvien -c <file>
pg_dump -Fc -d "${DATABASE_URL:-postgres://thuvien:moitinhdau142@localhost:5432/thuvien?sslmode=disable}" -f "$DEST/db-$STAMP.dump"

find "$DEST" -type f -name 'db-*.dump' -mtime +"$KEEP" -delete

printf '%s backup ok: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" \
  "$(du -sh "$DEST/db-$STAMP.dump" | cut -f1) db, $(ls -1 "$DEST" | wc -l | tr -d ' ') files kept"
