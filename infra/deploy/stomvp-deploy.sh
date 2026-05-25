#!/usr/bin/env bash
# MasterTop production deployment script.
# Usage: sudo /opt/stomvp/deploy.sh [branch]
# Default branch: main
#
# Flow: git pull -> npm ci -> Prisma -> build -> admin sync -> pm2 reload.
set -euo pipefail

BRANCH="${1:-main}"
APP_DIR="/opt/stomvp/app"
ADMIN_DIST="/opt/stomvp/admin-dist"
APP_USER="stomvp"
PM2_HOME_DIR="/var/lib/stomvp/.pm2"
API_CWD="$APP_DIR/apps/api"
API_ENTRY="$API_CWD/dist/apps/api/src/main.js"
TS=$(date +%Y%m%d-%H%M%S)
LOG=/var/log/stomvp-deploy.log

exec > >(tee -a "$LOG") 2>&1
echo "==================== $(date -u) DEPLOY START (branch=$BRANCH) ===================="

cd "$APP_DIR"

# Older deploys used npm install, which could rewrite package-lock.json on the VPS.
# Keep this cleanup so future git pulls stay idempotent even after manual fixes.
echo "-> Reset package-lock.json if a previous install dirtied it"
chown abduqodir:abduqodir package-lock.json 2>/dev/null || true
sudo -u abduqodir git restore -- package-lock.json 2>/dev/null || true

echo "-> git fetch + checkout $BRANCH"
sudo -u abduqodir git fetch origin "$BRANCH"
sudo -u abduqodir git checkout "$BRANCH"
sudo -u abduqodir git pull --ff-only origin "$BRANCH"
echo "-> HEAD: $(git rev-parse --short HEAD) - $(git log -1 --pretty=%s)"

# Sentry release tag: current HEAD commit. Errors in Sentry get grouped by this
# so we can see exactly which release introduced a regression.
SENTRY_RELEASE=$(sudo -u abduqodir git rev-parse HEAD)

echo "-> npm ci"
sudo -u abduqodir npm ci --no-audit --no-fund --include=dev

echo "-> prisma generate"
sudo -u abduqodir bash -c "cd apps/api && npx prisma generate"

echo "-> prisma migrate deploy"
sudo -u abduqodir bash -c "cd apps/api && npx prisma migrate deploy"

echo "-> build api + admin"
sudo -u abduqodir npm run build -w @stomvp/api
sudo -u abduqodir env VITE_SENTRY_RELEASE=$SENTRY_RELEASE npm run build -w @stomvp/admin

echo "-> sync admin-dist (with backup)"
cp -a "$ADMIN_DIST" "${ADMIN_DIST}.bak.${TS}"
rsync -av --delete "$APP_DIR/apps/admin/dist/" "$ADMIN_DIST/"
chown -R 501:staff "$ADMIN_DIST"

echo "-> prepare api runtime user"
id "$APP_USER" >/dev/null
install -d -o "$APP_USER" -g "$APP_USER" -m 0750 "$PM2_HOME_DIR"
chgrp "$APP_USER" "$API_CWD/.env"
chmod 0640 "$API_CWD/.env"

echo "-> remove legacy root PM2 api process if present"
if pm2 describe stomvp-api >/dev/null 2>&1; then
  pm2 delete stomvp-api
  pm2 save
fi

echo "-> pm2 reload/start as $APP_USER"
if sudo -H -u "$APP_USER" env PM2_HOME="$PM2_HOME_DIR" pm2 describe stomvp-api >/dev/null 2>&1; then
  sudo -H -u "$APP_USER" env PM2_HOME="$PM2_HOME_DIR" SENTRY_RELEASE="$SENTRY_RELEASE" pm2 reload stomvp-api --update-env
else
  sudo -H -u "$APP_USER" env PM2_HOME="$PM2_HOME_DIR" SENTRY_RELEASE="$SENTRY_RELEASE" pm2 start "$API_ENTRY" \
    --name stomvp-api \
    --cwd "$API_CWD" \
    --interpreter node \
    --node-args="--max-old-space-size=768"
fi
sudo -H -u "$APP_USER" env PM2_HOME="$PM2_HOME_DIR" pm2 save

echo "-> Cleanup: keep only the latest 5 admin-dist backups"
ls -1dt /opt/stomvp/admin-dist.bak.* 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "==================== $(date -u) DEPLOY DONE ===================="
