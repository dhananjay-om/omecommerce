import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { PermissionRepository, SyncPermissionsResult } from '../domain/repositories.js';
import { ALL_PERMISSIONS, SUPER_ADMIN_ROLE_CODE } from '../domain/permission-catalog.js';

export class PrismaPermissionRepository implements PermissionRepository {
  constructor(private readonly db: Db) {}

  async syncSuperAdminGrants(): Promise<SyncPermissionsResult> {
    for (const p of ALL_PERMISSIONS) {
      await this.db.permission.upsert({ where: { code: p.code }, update: {}, create: p });
    }
    const role = await this.db.role.upsert({
      where: { code: SUPER_ADMIN_ROLE_CODE },
      update: {},
      create: { code: SUPER_ADMIN_ROLE_CODE, name: 'Super Admin' },
    });
    const allPermissions = await this.db.permission.findMany({ select: { id: true } });
    // createMany's returned count is exactly the rows actually inserted — skipDuplicates
    // means an already-granted permission contributes 0, so this is the true "newly
    // granted" count, not the full permission catalog size.
    const { count: grantsAdded } = await this.db.rolePermission.createMany({
      data: allPermissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    return { permissionsRegistered: ALL_PERMISSIONS.length, grantsAdded };
  }
}
