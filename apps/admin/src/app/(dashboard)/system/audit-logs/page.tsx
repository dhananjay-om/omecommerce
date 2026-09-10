import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { AuditLog } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const ENTITY_TYPES = ['AdminUser', 'Role', 'System'] as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ entityType?: string }> }) {
  const { entityType } = await searchParams;
  const query = entityType ? `?entityType=${encodeURIComponent(entityType)}` : '';
  const logs = await apiGet<AuditLog[]>(`/admin/v1/audit-logs${query}`);

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who changed what, and when — scoped to the security-sensitive System area (admin users, roles &amp;
          permissions) this pass covers. Not every action in this app is logged here yet.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b">
        <Link
          href="/system/audit-logs"
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            !entityType ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          All
        </Link>
        {ENTITY_TYPES.map((t) => (
          <Link
            key={t}
            href={`/system/audit-logs?entityType=${t}`}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              entityType === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'AdminUser' ? 'Users' : t === 'Role' ? 'Roles' : 'System'}
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nothing logged yet.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.publicId}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>{log.actorEmail ?? <span className="text-muted-foreground">System</span>}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.entityType} · {log.entityId}
                  </TableCell>
                  <TableCell>{log.summary}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
