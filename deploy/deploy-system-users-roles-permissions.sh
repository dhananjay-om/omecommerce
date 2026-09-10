#!/usr/bin/env bash
# System: Users (Phase 1) + Roles & Permissions (Phase 2).
#
# Real RBAC tables already existed (Role/Permission/RolePermission/
# AdminUserRole) — this ships the admin UI that was missing, plus a
# small set of new backend routes on top of them:
#
#   - System > Users: real list/create/deactivate-reactivate/reset-
#     password/edit-roles. "Invite" = you set an initial password
#     directly and share it out of band — no email-invite flow exists
#     yet. An admin can never deactivate their own account (guarded
#     server-side, not just hidden in the UI).
#   - System > Roles & Permissions: real role list/create/delete, and a
#     per-role permission checklist editor (grouped by category — 30
#     permissions across ~10 areas). Super Admin can't be deleted; any
#     other role still assigned to an admin user is blocked from
#     deletion until it's reassigned.
#
# One schema addition: AdminUser.lastLoginAt (nullable, set on every
# successful login). No new permission — everything here reuses the
# existing admin:manage (the same permission that already gates Sync
# Permissions).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-system-users-roles-permissions.sh
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

echo "==> Applying the new admin_user.last_login_at column"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (System > Users, System > Roles & Permissions)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission to sync — reuses admin:manage,"
echo "the same one Stores > Admin Permissions already required."
echo
echo "Try it:"
echo "  - System > Users > New User — create one, assign it a role, then"
echo "    (in a private/incognito window) log in as that user and confirm"
echo "    it can only do what its role's permissions allow."
echo "  - System > Roles & Permissions > New Role — create one, click"
echo "    'Edit Permissions', check a few, save. Assign it to a user from"
echo "    System > Users to actually use it. Remember: a permission change"
echo "    only takes effect after that admin signs out and back in."
