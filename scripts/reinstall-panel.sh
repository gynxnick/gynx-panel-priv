#!/usr/bin/env bash
#
# gynx-panel — safe rebuild
#
# Re-clones the panel source from GitHub, reinstalls Composer + Yarn deps,
# rebuilds the React bundle, and re-runs migrations against the existing
# database. Preserves:
#   - MySQL database (all server/user/settings rows)
#   - .env (DB creds, APP_KEY, integrations)
#   - Wings + server volumes (/var/lib/pterodactyl/volumes/)
#   - Existing nginx site config
#
# Run as root on the panel VPS:
#   curl -fsSL https://raw.githubusercontent.com/gynxnick/gynx-panel/main/scripts/reinstall-panel.sh | sudo bash
#
# Or, with the repo already on disk:
#   sudo bash /opt/gynx-panel/scripts/reinstall-panel.sh
#
# Flags:
#   --target-dir <path>   Panel source dir (default: /opt/gynx-panel)
#   --branch <name>       Git branch to deploy (default: main)
#   --remote <url>        Git remote (default: https://github.com/gynxnick/gynx-panel.git)
#   --fresh-db            Drop + recreate the DB before migrating. DESTROYS
#                         every server, user, and setting. Don't use unless
#                         you actually want that.
#   --skip-services       Skip the systemctl restart at the end.
#   -y, --yes             Don't prompt for confirmation.
#

set -euo pipefail

# ---- defaults ---------------------------------------------------------------

TARGET_DIR="/opt/gynx-panel"
BRANCH="main"
REMOTE="https://github.com/gynxnick/gynx-panel.git"
FRESH_DB=0
SKIP_SERVICES=0
ASSUME_YES=0

# ---- arg parse --------------------------------------------------------------

while [[ $# -gt 0 ]]; do
    case "$1" in
        --target-dir)   TARGET_DIR="$2"; shift 2 ;;
        --branch)       BRANCH="$2"; shift 2 ;;
        --remote)       REMOTE="$2"; shift 2 ;;
        --fresh-db)     FRESH_DB=1; shift ;;
        --skip-services) SKIP_SERVICES=1; shift ;;
        -y|--yes)       ASSUME_YES=1; shift ;;
        -h|--help)
            sed -n '2,30p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        *) echo "unknown flag: $1" >&2; exit 2 ;;
    esac
done

# ---- helpers ----------------------------------------------------------------

c_red()    { printf '\033[31m%s\033[0m\n' "$*"; }
c_green()  { printf '\033[32m%s\033[0m\n' "$*"; }
c_yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
c_blue()   { printf '\033[34m%s\033[0m\n' "$*"; }
step()     { c_blue "==> $*"; }
warn()     { c_yellow "WARN: $*"; }
die()      { c_red   "ERROR: $*"; exit 1; }

require_root() {
    [[ $EUID -eq 0 ]] || die "Run as root (sudo)."
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "Missing command: $1. Install it first."
}

confirm() {
    [[ $ASSUME_YES -eq 1 ]] && return 0
    read -r -p "$1 [y/N] " ans
    [[ "$ans" =~ ^[Yy] ]]
}

# Read a key from a .env-style file. Strips quotes around the value.
env_get() {
    local file=$1 key=$2
    grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

# ---- preflight --------------------------------------------------------------

require_root
require_cmd git
require_cmd composer
require_cmd yarn
require_cmd php
require_cmd mysql

step "preflight"
echo "  target dir : $TARGET_DIR"
echo "  branch     : $BRANCH"
echo "  remote     : $REMOTE"
echo "  fresh db   : $FRESH_DB"
echo "  skip svc   : $SKIP_SERVICES"

# ---- backup DB + .env -------------------------------------------------------

BACKUP_DIR="/var/backups/gynx-panel/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if [[ -f "$TARGET_DIR/.env" ]]; then
    step "backing up existing .env → $BACKUP_DIR/.env"
    cp "$TARGET_DIR/.env" "$BACKUP_DIR/.env"

    DB_HOST=$(env_get "$TARGET_DIR/.env" DB_HOST)
    DB_PORT=$(env_get "$TARGET_DIR/.env" DB_PORT)
    DB_DATABASE=$(env_get "$TARGET_DIR/.env" DB_DATABASE)
    DB_USERNAME=$(env_get "$TARGET_DIR/.env" DB_USERNAME)
    DB_PASSWORD=$(env_get "$TARGET_DIR/.env" DB_PASSWORD)

    if [[ -n "${DB_DATABASE:-}" && -n "${DB_USERNAME:-}" ]]; then
        step "dumping database $DB_DATABASE → $BACKUP_DIR/$DB_DATABASE.sql.gz"
        MYSQL_PWD="$DB_PASSWORD" mysqldump \
            -h "${DB_HOST:-127.0.0.1}" \
            -P "${DB_PORT:-3306}" \
            -u "$DB_USERNAME" \
            --single-transaction --quick --lock-tables=false \
            "$DB_DATABASE" \
            | gzip > "$BACKUP_DIR/$DB_DATABASE.sql.gz"
        c_green "  $(du -h "$BACKUP_DIR/$DB_DATABASE.sql.gz" | cut -f1) saved"
    else
        warn "couldn't read DB creds from .env — skipping mysqldump"
    fi
else
    warn "no existing .env at $TARGET_DIR/.env — treating as fresh install"
fi

# ---- confirmation -----------------------------------------------------------

cat <<EOF

About to:
  1. mv  $TARGET_DIR  →  ${TARGET_DIR}.old.$(date +%s)
  2. git clone $REMOTE ($BRANCH) into $TARGET_DIR
  3. cp the backed-up .env into the new clone
  4. composer install --no-dev && yarn install && yarn build:production
  5. php artisan migrate --force$( [[ $FRESH_DB -eq 1 ]] && echo "  (after dropping + re-creating $DB_DATABASE)" )
  6. fix permissions (www-data:www-data)
  7. restart php-fpm + nginx + pteroq

Backups in: $BACKUP_DIR
EOF

if ! confirm "Proceed?"; then
    c_yellow "aborted."
    exit 0
fi

# ---- optional: fresh DB -----------------------------------------------------

if [[ $FRESH_DB -eq 1 ]]; then
    [[ -n "${DB_DATABASE:-}" ]] || die "Can't --fresh-db without DB creds in .env"
    step "DROPPING + recreating database $DB_DATABASE"
    MYSQL_PWD="$DB_PASSWORD" mysql -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "$DB_USERNAME" <<SQL
DROP DATABASE IF EXISTS \`$DB_DATABASE\`;
CREATE DATABASE \`$DB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SQL
fi

# ---- move old, clone fresh --------------------------------------------------

if [[ -d "$TARGET_DIR" ]]; then
    OLD="${TARGET_DIR}.old.$(date +%s)"
    step "moving existing source aside → $OLD"
    mv "$TARGET_DIR" "$OLD"
fi

step "cloning $REMOTE ($BRANCH) → $TARGET_DIR"
git clone --branch "$BRANCH" --depth 1 "$REMOTE" "$TARGET_DIR"

# Mark this dir as safe so root can run git in it later (we'll chown to
# www-data below, which would otherwise trip "dubious ownership").
git config --global --add safe.directory "$TARGET_DIR" || true

# ---- restore .env -----------------------------------------------------------

if [[ -f "$BACKUP_DIR/.env" ]]; then
    step "restoring .env"
    cp "$BACKUP_DIR/.env" "$TARGET_DIR/.env"
else
    warn "no .env backup — generating from .env.example. You'll need to run"
    warn "  php artisan p:environment:setup  +  p:environment:database  manually."
    cp "$TARGET_DIR/.env.example" "$TARGET_DIR/.env"
fi

# ---- composer + yarn --------------------------------------------------------

cd "$TARGET_DIR"

step "composer install --no-dev --optimize-autoloader"
composer install --no-dev --optimize-autoloader --no-interaction

step "yarn install --frozen-lockfile"
yarn install --frozen-lockfile

step "yarn build:production"
yarn build:production

# ---- artisan: migrate + clear caches ---------------------------------------

step "php artisan migrate --force"
php artisan migrate --force

step "clearing config / view / route caches"
php artisan config:clear
php artisan view:clear
php artisan route:clear

# ---- permissions ------------------------------------------------------------

step "fixing permissions (www-data:www-data)"
chown -R www-data:www-data "$TARGET_DIR"
chmod -R 755 "$TARGET_DIR/storage" "$TARGET_DIR/bootstrap/cache" || true

# ---- restart services -------------------------------------------------------

if [[ $SKIP_SERVICES -eq 0 ]]; then
    step "restarting services"
    for svc in nginx pteroq php8.1-fpm php8.2-fpm php8.3-fpm php8.4-fpm; do
        if systemctl list-unit-files | grep -q "^${svc}\.service"; then
            systemctl restart "$svc" 2>/dev/null && c_green "  restarted $svc" || warn "  $svc restart failed"
        fi
    done
fi

# ---- done -------------------------------------------------------------------

c_green ""
c_green "================================================================"
c_green "  gynx-panel rebuild complete"
c_green "================================================================"
echo ""
echo "  Source:   $TARGET_DIR"
echo "  Backups:  $BACKUP_DIR"
echo "  Branch:   $BRANCH @ $(cd "$TARGET_DIR" && git rev-parse --short HEAD)"
echo ""
echo "  Hard-refresh the panel in your browser to load the new bundle."
echo ""
