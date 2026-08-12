import type { OrderEmailLogEntry } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { statusBadgeVariant } from '@/lib/status-badge';

export function EmailLogCard({ log }: { log: OrderEmailLogEntry[] }) {
  if (log.length === 0) {
    return <p className="text-sm text-muted-foreground">No emails sent yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Sent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {log.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{entry.emailType}</TableCell>
            <TableCell>{entry.toEmail}</TableCell>
            <TableCell className="max-w-xs truncate">{entry.subject}</TableCell>
            <TableCell>
              <Badge variant={statusBadgeVariant(entry.status)}>{entry.status}</Badge>
            </TableCell>
            <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
