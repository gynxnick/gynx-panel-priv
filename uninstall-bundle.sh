#!/usr/bin/env bash
# gynx-panel — bundle uninstaller / rollback
#
# Restores the Pterodactyl panel's public/assets/ from a backup taken by
# install-bundle.sh. This reverts the client SPA to whatever was live before
# the most recent gynx-panel deploy.
#
# Usage:
#   sudo ./uninstall-bundle.sh --from-backup latest
#   sudo ./uninstall-bundle.sh --from-backup 20260424T010203Z
#   sudo ./uninstall-bundle.sh -l                        # list backups
#   sudo ./uninstall-bundle.sh -p /srv/pterodactyl --from-backup latest

set -euo pipefail

PANEL="/var/www/pterodactyl"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"
BACKUP_ROOT="$SCRIPT_DIR/backups"
FROM_BACKUP=""

usage() {
  cat <<EOF
gynx-panel — bundle uninstaller

Usage: sudo $0 [options]

Options:
  -p, --panel <path>       Pterodactyl install root (default: /var/www/pterodactyl)
  -b, --from-backup <id>   Restore from backups/<id> ('latest' allowed)
  -l, --list-backups       List available backups and exit
  -h, --help               Show this help
EOF
}

list_backups() {
  if [[ ! -d "$BACKUP_ROOT" ]]; then
    echo "no backups at $BACKUP_ROOT"
    return
  fi
  echo "available backups:"
  for d in "$BACKUP_ROOT"/*/; do
    [[ -d "$d" ]] || continue
    name="$(basename "$d")"
    [[ "$name" == "latest" ]] && continue
    printf "  %s\n" "$name"
  done
  if [[ -L "$BACKUP_ROOT/latest" ]]; then
    printf "  latest -> %s\n" "$(readlink "$BACKUP_ROOT/latest")"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--panel)        PANEL="$2"; shift 2 ;;
    -b|--from-backup)  FROM_BACKUP="$2"; shift 2 ;;
    -l|--list-backups) list_backups; exit 0 ;;
    -h|--help)         usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

# ---------- output ----------

if [[ -t 1 ]]; then
  C_RESET="$(printf '\033[0m')"
  C_PURPLE="$(printf '\033[38;5;141m')"
  C_CYAN="$(printf '\033[38;5;87m')"
  C_RED="$(printf '\033[38;5;203m')"
  C_GREEN="$(printf '\033[38;5;114m')"
else
  C_RESET=""; C_PURPLE=""; C_CYAN=""; C_RED=""; C_GREEN=""
fi

log()  { printf "%s[gynx-panel]%s %s\n" "$C_PURPLE" "$C_RESET" "$*"; }
ok()   { printf "%s  ok%s %s\n" "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf "%s warn%s %s\n" "$C_CYAN" "$C_RESET" "$*"; }
die()  { printf "%s fail%s %s\n" "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

# ---------- pre-flight ----------

[[ -n "$FROM_BACKUP" ]] || die "--from-backup <id> is required. Try: $0 -l"
[[ -d "$PANEL" ]]       || die "panel path not found: $PANEL"
[[ -f "$PANEL/artisan" ]] || die "no artisan at $PANEL"

BACKUP_DIR="$BACKUP_ROOT/$FROM_BACKUP"
[[ -d "$BACKUP_DIR" ]]                  || die "backup not found: $BACKUP_DIR  (try -l)"
[[ -d "$BACKUP_DIR/assets" ]]           || die "no assets/ in $BACKUP_DIR — is this a gynx-panel backup?"

PANEL_USER="$(stat -c '%U' "$PANEL" 2>/dev/null || echo www-data)"
PANEL_GROUP="$(stat -c '%G' "$PANEL" 2>/dev/null || echo www-data)"

log "panel:  $PANEL"
log "source: $BACKUP_DIR/assets"

# ---------- restore ----------

# Snapshot the current (gynx) assets before restoring, in case the user wants
# to re-deploy later. Goes to backups/<ts>.pre-rollback/.
PRE_TS="$(date -u +%Y%m%dT%H%M%SZ).pre-rollback"
PRE_DIR="$BACKUP_ROOT/$PRE_TS"
mkdir -p "$PRE_DIR"
cp -rp "$PANEL/public/assets" "$PRE_DIR/assets"
log "snapshotted current (pre-rollback) assets to: $PRE_DIR/assets"

log "restoring assets from backup"
rm -rf "$PANEL/public/assets"
cp -rp "$BACKUP_DIR/assets" "$PANEL/public/assets"
chown -R "$PANEL_USER:$PANEL_GROUP" "$PANEL/public/assets" 2>/dev/null || true
ok "assets restored"

# ---------- clear cache ----------

if command -v php >/dev/null 2>&1; then
  log "clearing pterodactyl caches"
  ( cd "$PANEL" && sudo -u "$PANEL_USER" php artisan view:clear )  || warn "view:clear failed"
  ( cd "$PANEL" && sudo -u "$PANEL_USER" php artisan cache:clear ) || warn "cache:clear failed"
  ok "caches cleared"
else
  warn "php not found — run 'php artisan view:clear && php artisan cache:clear' manually"
fi

printf "\n%s[gynx-panel]%s rollback complete. Hard-refresh the browser to see stock assets.\n" "$C_PURPLE" "$C_RESET"
printf "  pre-rollback snapshot saved at: %s\n\n" "$PRE_DIR"
