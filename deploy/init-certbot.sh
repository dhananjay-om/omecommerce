#!/usr/bin/env bash
# One-time bootstrap: obtains the FIRST real Let's Encrypt certificate for a
# fresh deployment. Run this once, from the repo root, AFTER:
#   1. cp .env.production.example .env.production and filling it in
#      (including LETSENCRYPT_EMAIL)
#   2. editing deploy/nginx.conf's YOUR_DOMAIN_HERE placeholders to your
#      real domain
#   3. `docker compose -f docker-compose.prod.yml --env-file .env.production
#      up -d --build postgres redis opensearch minio api admin storefront
#      certbot` (everything EXCEPT nginx — nginx isn't started yet; see why
#      below)
#
# Why this script exists: nginx's config references certificate files at
# /etc/letsencrypt/live/$DOMAIN/{fullchain,privkey}.pem, but on a fresh
# server those don't exist yet — and Let's Encrypt can't issue a cert until
# nginx is running to serve the HTTP-01 challenge it presents. This script
# breaks that chicken-and-egg loop the standard way: drop in a throwaway
# self-signed certificate so nginx can start at all, start it, request the
# REAL certificate through the now-running nginx, then reload nginx with it.
# After this runs once, the `certbot` service in docker-compose.prod.yml
# renews the real certificate automatically — this script never needs to
# run again on this server.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env.production ]; then
  echo "!! .env.production not found — copy .env.production.example and fill it in first." >&2
  exit 1
fi
# shellcheck disable=SC1091
set -a; source .env.production; set +a
: "${DOMAIN:?DOMAIN must be set in .env.production}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL must be set in .env.production}"

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.production)

echo "==> [1/5] Creating a throwaway self-signed certificate so nginx can start"
"${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "
  mkdir -p '/etc/letsencrypt/live/$DOMAIN' &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout '/etc/letsencrypt/live/$DOMAIN/privkey.pem' \
    -out '/etc/letsencrypt/live/$DOMAIN/fullchain.pem' \
    -subj '/CN=$DOMAIN'
"

echo "==> [2/5] Starting nginx"
"${COMPOSE[@]}" up -d nginx

echo "==> [3/5] Deleting the throwaway certificate"
"${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "
  rm -rf '/etc/letsencrypt/live/$DOMAIN' '/etc/letsencrypt/archive/$DOMAIN' '/etc/letsencrypt/renewal/$DOMAIN.conf'
"

echo "==> [4/5] Requesting the real certificate from Let's Encrypt"
"${COMPOSE[@]}" run --rm certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email

echo "==> [5/5] Reloading nginx with the real certificate"
"${COMPOSE[@]}" exec nginx nginx -s reload

echo
echo "Done — https://$DOMAIN should now serve a valid, trusted certificate."
echo "The 'certbot' service will keep it renewed automatically from here on."
