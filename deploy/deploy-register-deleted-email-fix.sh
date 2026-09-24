#!/usr/bin/env bash
# Fixes "Internal Server Error" when creating a storefront account with an email
# that once belonged to a customer who was later DELETED in the admin.
#
# Cause: "Delete customer" only deactivates the account (their orders, wallet etc.
# are kept), so the deleted account still held the email address and the database
# refused a second account with it — the sign-up form just showed a raw
# "Internal Server Error".
#
# Now: registering with such an email works. The old (deleted) account is left
# as it was, with its email renamed to "<email>.deleted.<id>" so the address is
# free; the person gets a brand-new, empty account (they do NOT inherit the old
# account's orders/wallet/addresses — signing up doesn't prove who owns the
# address). Two people signing up with the same email at the same instant now get
# the normal "already registered" message instead of a crash.
#
# API only. No migration, no new permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-register-deleted-email-fix.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. Try creating the account again on the storefront."
