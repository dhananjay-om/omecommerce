import type { PermissionRepository } from '../domain/repositories.js';
import type { SyncPermissionsResult } from '../domain/repositories.js';

/**
 * Closes the gap a growing PERMISSIONS catalog otherwise leaves open: seeding
 * only ever runs once (or gets skipped on a redeploy that isn't a fresh
 * install), so a permission added to the codebase after go-live — e.g.
 * `coupon:manage` when the Coupons feature shipped later than the initial
 * RBAC seed — never reaches an existing super-admin's role grants on its
 * own. This re-runs that exact upsert-and-grant logic safely against a
 * database that's already live with real data, without touching anything
 * else `db:seed` does (demo catalog, default website, etc.).
 *
 * Does NOT refresh any admin's already-issued JWT — permissions are baked
 * into the token at login, so an admin must log out and back in to actually
 * see the newly granted access.
 */
export class SyncPermissions {
  constructor(private readonly permissions: PermissionRepository) {}

  async execute(): Promise<SyncPermissionsResult> {
    return this.permissions.syncSuperAdminGrants();
  }
}
