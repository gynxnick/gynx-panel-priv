#!/usr/bin/env bash
# gynx-panel — compiled-bundle installer
#
# Replaces the live Pterodactyl panel's client assets (the React SPA bundle) with
# a custom build produced by `yarn build:production` in this repo.
#
# Usage:
#   # 1. Build on a box with Node + yarn:
#   yarn install && yarn build:production
#
#   # 2. Copy the repo (or just public/assets/) to the panel host, then:
#   sudo ./install-bundle.sh                              # default panel path
#   sudo ./install-bundle.sh -p /srv/pterodactyl          # custom panel path
#   sudo ./install-bundle.sh -d /path/to/public/assets    # assets from elsewhere
#
# Rollback: sudo ./uninstall-bundle.sh --from-backup latest
#
# What changes: only files under {panel}/public/assets/. Backend PHP, Blade
# templates, admin panel, config, database, uploads — all untouched.

set -euo pipefail

PANEL="/var/www/pterodactyl"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"
ASSETS_SRC="$SCRIPT_DIR/public/assets"
BACKUP_ROOT="$SCRIPT_DIR/backups"

usage() {
  cat <<EOF
gynx-panel — bundle installer

Usage: sudo $0 [options]

Options:
  -p, --panel <path>    Pterodactyl install root (default: /var/www/pterodactyl)
  -d, --assets <path>   Compiled assets directory (default: ./public/assets)
  -h, --help            Show this help

Pre-flight: the assets directory must contain a built bundle (manifest.json +
bundle.HASH.js + bundle.HASH.css). Run 'yarn install && yarn build:production'
first.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--panel)   PANEL="$2"; shift 2 ;;
    -d|--assets)  ASSETS_SRC="$2"; shift 2 ;;
    -h|--help)    usage; exit 0 ;;
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

if [[ $EUID -ne 0 ]]; then
  warn "not running as root — file ownership may be wrong."
fi

[[ -d "$PANEL" ]]                   || die "panel path not found: $PANEL"
[[ -f "$PANEL/artisan" ]]           || die "no artisan at $PANEL — not a pterodactyl install?"
[[ -d "$PANEL/public/assets" ]]     || die "no public/assets at $PANEL — unusual panel layout"
[[ -d "$ASSETS_SRC" ]]              || die "built assets not found at $ASSETS_SRC
  -> run: yarn install && yarn build:production
  -> or pass -d /path/to/public/assets"

# Sanity-check that the source really is a built bundle.
if [[ ! -f "$ASSETS_SRC/manifest.json" ]]; then
  die "no manifest.json in $ASSETS_SRC — this doesn't look like a production build.
  -> build output should be the repo's public/assets/ after 'yarn build:production'."
fi

# Count bundle files — catch empty / stale builds.
BUNDLE_COUNT="$(find "$ASSETS_SRC" -maxdepth 1 -name 'bundle.*.js' | wc -l | tr -d ' ')"
[[ $BUNDLE_COUNT -gt 0 ]] || die "no bundle.*.js files in $ASSETS_SRC — build looks incomplete"

PANEL_USER="$(stat -c '%U' "$PANEL" 2>/dev/null || echo www-data)"
PANEL_GROUP="$(stat -c '%G' "$PANEL" 2>/dev/null || echo www-data)"

log "panel:  $PANEL"
log "assets: $ASSETS_SRC  ($BUNDLE_COUNT bundle(s))"
log "owner:  $PANEL_USER:$PANEL_GROUP"

# ---------- backup ----------

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$BACKUP_ROOT/$TS"
mkdir -p "$BACKUP_DIR"

log "backing up current assets to: $BACKUP_DIR/assets"
cp -rp "$PANEL/public/assets" "$BACKUP_DIR/assets"

cat > "$BACKUP_DIR/manifest.txt" <<EOF
# gynx-panel backup manifest
# created: $TS
# panel:   $PANEL
# restore: sudo $SCRIPT_DIR/uninstall-bundle.sh --from-backup $TS
EOF

ln -sfn "$TS" "$BACKUP_ROOT/latest"
ok "backup complete"

# ---------- deploy ----------

log "deploying new bundle to $PANEL/public/assets"
# Remove stale files that aren't in the new build — keeps public/assets clean,
# avoids mixing old & new chunk files with different hashes.
rm -rf "$PANEL/public/assets"
cp -rp "$ASSETS_SRC" "$PANEL/public/assets"
chown -R "$PANEL_USER:$PANEL_GROUP" "$PANEL/public/assets" 2>/dev/null || true
ok "bundle deployed"

# ---------- clear cache ----------

if command -v php >/dev/null 2>&1; then
  log "clearing pterodactyl caches"
  ( cd "$PANEL" && sudo -u "$PANEL_USER" php artisan view:clear )  || warn "view:clear failed"
  ( cd "$PANEL" && sudo -u "$PANEL_USER" php artisan cache:clear ) || warn "cache:clear failed"
  ok "caches cleared"
else
  warn "php not found — run 'php artisan view:clear && php artisan cache:clear' manually"
fi

# ---------- done ----------

printf "\n%s[gynx-panel]%s deploy complete.\n" "$C_PURPLE" "$C_RESET"
printf "  backup:    %s\n" "$BACKUP_DIR"
printf "  rollback:  sudo %s/uninstall-bundle.sh --from-backup latest\n\n" "$SCRIPT_DIR"
printf "Hard-refresh your browser (Ctrl+Shift+R) to pick up the new bundle.\n"
