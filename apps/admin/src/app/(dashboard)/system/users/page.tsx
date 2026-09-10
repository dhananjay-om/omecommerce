import { apiGet } from '@/lib/api-client';
import type { AdminUser, Role } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewAdminUserDialog } from './new-admin-user-dialog';
import { EditRolesDialog } from './edit-roles-dialog';
import { ToggleActiveButton } from './toggle-active-button';
import { ResetPasswordDialog } from './reset-password-dialog';

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString();
}

export default async function AdminUsersPage() {
  const [users, roles, me] = await Promise.all([
    apiGet<AdminUser[]>('/admin/v1/auth/admin-users'),
    apiGet<Role[]>('/admin/v1/auth/roles'),
    apiGet<{ publicId: string }>('/admin/v1/auth/me'),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin team members and their access. Roles determine what each person can do — assign one or more
            under Roles &amp; Permissions, then grant it here.
          </p>
        </div>
        <NewAdminUserDialog roles={roles} />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No admin users yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.publicId}>
                  <TableCell className="font-medium">
                    {u.email}
                    {u.publicId === me.publicId ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No roles</span>
                      ) : (
                        u.roles.map((r) => (
                          <Badge key={r.code} variant="secondary">
                            {r.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'success' : 'secondary'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(u.lastLoginAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <EditRolesDialog user={u} roles={roles} />
                      <ResetPasswordDialog publicId={u.publicId} email={u.email} />
                      <ToggleActiveButton publicId={u.publicId} email={u.email} isActive={u.isActive} isSelf={u.publicId === me.publicId} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
