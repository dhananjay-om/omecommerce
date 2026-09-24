#!/usr/bin/env bash
# Fixes "Validation failed" when creating a referral program in Admin >
# Loyalty & Referrals > Referrals.
#
# Cause: on "Create Program" the form sent every left-blank optional field
# (max referrals, attribution window, unused points/amount fields) as an explicit
# "null", which the create endpoint rejects. Now blank fields are simply left out.
# (Editing an existing program was never affected.)
#
# Also: a real validation problem now names the field ("maxReferralsPerCustomer:
# ...") instead of only saying "Validation failed", and the two reward boxes are
# renamed "Reward for the referrer" (the existing customer who shares the link)
# and "Reward for the new customer (referee)" (the friend who signs up) so it's
# clear they are two different rewards, not a duplicate.
#
# Admin only. No migration, no new permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-referral-create-fix.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding admin"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. Hard-reload the admin (Ctrl+Shift+R) and create the referral program again."
