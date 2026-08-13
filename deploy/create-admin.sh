#!/usr/bin/env bash
# Creates a real admin account (super-admin role) using the seeded dev
# admin's credentials to authorize the call — see DEPLOYMENT.md §7 for why
# this needs to run this way (it's the backend's own /admin/v1/... route,
# not exposed through either public app, so it has to run from inside the
# api container against its own localhost).
#
# Usage: ./deploy/create-admin.sh you@yourcompany.com 'a-real-strong-password'
#
# Email/password are passed to the JS snippet via environment variables
# (not interpolated directly into the JS source string) so any character —
# including a literal single quote — in your password is safe to use.
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <email> <password>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

docker compose -f docker-compose.prod.yml --env-file .env.production exec \
  -e NEW_ADMIN_EMAIL="$1" -e NEW_ADMIN_PASSWORD="$2" \
  api node -e "
const email = process.env.NEW_ADMIN_EMAIL;
const password = process.env.NEW_ADMIN_PASSWORD;
fetch('http://localhost:3000/admin/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@ome.local', password: 'dev-only-password-change-me' }),
}).then(r => r.json()).then(({ data }) =>
  fetch('http://localhost:3000/admin/v1/auth/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.token },
    body: JSON.stringify({ email, password, roleCodes: ['super-admin'] }),
  })
).then(r => r.json()).then(result => {
  console.log(JSON.stringify(result, null, 2));
});
"

echo
echo "If that printed your new email under \"data\" (not an error), log in at"
echo "https://<your-domain>/admin/login with it now."
