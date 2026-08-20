export interface AdminUserRecord {
  id: bigint;
  publicId: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
}

export interface CreateAdminUserInput {
  email: string;
  passwordHash: string;
  roleCodes: string[];
}

export interface AdminUserRepository {
  findByEmail(email: string): Promise<AdminUserRecord | null>;
  findByPublicId(publicId: string): Promise<AdminUserRecord | null>;
  create(input: CreateAdminUserInput): Promise<{ publicId: string; email: string }>;
  /** All permission codes granted to this admin, across every role they hold. */
  findPermissions(adminUserId: bigint): Promise<string[]>;
}

export interface SyncPermissionsResult {
  permissionsRegistered: number;
  grantsAdded: number;
}

/** Backs SyncPermissions — registers every permission in the catalog and tops up the
 *  super-admin role's grants to match, without touching any other seed data. */
export interface PermissionRepository {
  syncSuperAdminGrants(): Promise<SyncPermissionsResult>;
}
