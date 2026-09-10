import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { Role } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { NewRoleDialog } from './new-role-dialog';
import { DeleteRoleDialog } from './delete-role-dialog';

const SUPER_ADMIN_ROLE_CODE = 'super-admin';

export default async function RolesPage() {
  const roles = await apiGet<Role[]>('/admin/v1/auth/roles');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles &amp; Permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A role is a named bundle of permissions — grant one or more to an admin user under System &gt; Users.
            Super Admin is protected and always holds every permission (use Stores &gt; Admin Permissions &gt; Sync
            Permissions to top it up after a new feature ships).
          </p>
        </div>
        <NewRoleDialog />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Users</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No roles yet.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((r) => {
                const isSuperAdmin = r.code === SUPER_ADMIN_ROLE_CODE;
                const blockedReason = isSuperAdmin
                  ? 'The Super Admin role cannot be deleted.'
                  : r.userCount > 0
                    ? `Still assigned to ${r.userCount} admin user${r.userCount === 1 ? '' : 's'} — reassign them first.`
                    : null;
                return (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">
                      {r.name}
                      {isSuperAdmin ? (
                        <Badge variant="secondary" className="ml-2">
                          Protected
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.code}</TableCell>
                    <TableCell>{r.permissionCodes.length}</TableCell>
                    <TableCell>{r.userCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/system/roles/${r.code}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                          Edit Permissions
                        </Link>
                        <DeleteRoleDialog code={r.code} name={r.name} blockedReason={blockedReason} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
