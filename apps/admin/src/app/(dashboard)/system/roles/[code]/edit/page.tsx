import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import type { Role, Permission } from '@/lib/types';
import { BackLink } from '@/components/back-link';
import { PermissionChecklistForm } from './permission-checklist-form';

export default async function EditRolePermissionsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Both routes always return an array (never 404 themselves) — a
  // missing role is detected below via role.find(), not a caught error.
  const [roles, permissions] = await Promise.all([apiGet<Role[]>('/admin/v1/auth/roles'), apiGet<Permission[]>('/admin/v1/auth/permissions')]);

  const role = roles.find((r) => r.code === code);
  if (!role) notFound();

  return (
    <div>
      <BackLink href="/system/roles" label="Back to Roles & Permissions" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Permissions — {role.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every admin user holding this role gets exactly the permissions checked below. They need to sign out and
        back in for a change to take effect.
      </p>
      <div className="mt-6">
        <PermissionChecklistForm code={role.code} permissions={permissions} grantedCodes={role.permissionCodes} />
      </div>
    </div>
  );
}
