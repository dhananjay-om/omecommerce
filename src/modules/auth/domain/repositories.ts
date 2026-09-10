export interface AdminUserRecord {
  id: bigint;
  publicId: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
}

export interface AdminUserRoleSummary {
  code: string;
  name: string;
}

export interface AdminUserListItem {
  publicId: string;
  email: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: AdminUserRoleSummary[];
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
  /** Admin browse (System > Users) — every non-deleted user, newest first. */
  list(): Promise<AdminUserListItem[]>;
  setActive(publicId: string, isActive: boolean): Promise<void>;
  /** Replaces this admin's whole role assignment set with `roleCodes` —
   *  unknown codes are silently ignored (same "resolve real codes, drop
   *  the rest" posture as MegaMenuItem's category picker). */
  updateRoles(publicId: string, roleCodes: string[]): Promise<void>;
  resetPassword(publicId: string, passwordHash: string): Promise<void>;
  /** Called on every successful login — see AdminUser.lastLoginAt's own doc comment. */
  recordLogin(id: bigint): Promise<void>;
}

export interface RoleListItem {
  code: string;
  name: string;
  permissionCodes: string[];
  userCount: number;
}

export interface RoleRepository {
  /** Admin browse (System > Roles & Permissions) — also the source for
   *  every role picker (User create/edit dialogs), which just ignores
   *  the permissionCodes/userCount fields it doesn't need. */
  list(): Promise<RoleListItem[]>;
  findByCode(code: string): Promise<RoleListItem | null>;
  create(code: string, name: string): Promise<void>;
  /** Replaces the role's whole permission grant set with `permissionCodes`. */
  updatePermissions(code: string, permissionCodes: string[]): Promise<void>;
  delete(code: string): Promise<void>;
}

export interface PermissionSummary {
  code: string;
  description: string;
}

export interface SyncPermissionsResult {
  permissionsRegistered: number;
  grantsAdded: number;
}

/** Backs SyncPermissions — registers every permission in the catalog and tops up the
 *  super-admin role's grants to match, without touching any other seed data. Also
 *  the read side for the Roles & Permissions editor's permission checklist. */
export interface PermissionRepository {
  syncSuperAdminGrants(): Promise<SyncPermissionsResult>;
  /** Every registered permission — the real, current set (post-sync), not
   *  the static catalog file, so this reflects what's actually grantable
   *  today. */
  listAll(): Promise<PermissionSummary[]>;
}
