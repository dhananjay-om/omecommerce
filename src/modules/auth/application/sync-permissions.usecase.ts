import type { PermissionRepository } from '../domain/repositories.js';
import type { SyncPermissionsResult } from '../domain/repositories.js';
import type { AuditLogRepository } from '../../audit/domain/repositories.js';
import type { AuditActor } from './audit-actor.js';

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
  constructor(
    private readonly permissions: PermissionRepository,
    private readonly auditLogs?: AuditLogRepository,
  ) {}

  async execute(actor?: AuditActor): Promise<SyncPermissionsResult> {
    const result = await this.permissions.syncSuperAdminGrants();
    await this.auditLogs?.record({
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: 'PERMISSIONS_SYNCED',
      entityType: 'System',
      entityId: 'permissions',
      summary: `Synced permissions — ${result.grantsAdded} new grant(s) added to Super Admin (${result.permissionsRegistered} total registered)`,
    });
    return result;
  }
}
