import { apiGet } from '@/lib/api-client';
import type { AttributeSetDetail, Attribute } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewGroupDialog } from './new-group-dialog';
import { AssignAttributeDialog } from './assign-attribute-dialog';

export default async function AttributeSetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, attributes] = await Promise.all([
    apiGet<AttributeSetDetail>(`/admin/v1/attribute-sets/${id}`),
    apiGet<Attribute[]>('/admin/v1/attributes'),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{detail.name}</h1>
          <p className="text-sm text-muted-foreground">
            {detail.code}
            {detail.isDefault ? ' · Default set' : ''}
          </p>
        </div>
        <NewGroupDialog attributeSetId={detail.id} />
      </div>

      <div className="mt-6 space-y-6">
        {detail.groups.length === 0 ? (
          <p className="text-muted-foreground">No groups yet. Create one to start assigning attributes.</p>
        ) : (
          detail.groups.map((group) => (
            <div key={group.id} className="rounded-md border">
              <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
                <h2 className="font-medium">{group.name}</h2>
                <AssignAttributeDialog attributeSetId={detail.id} groupId={group.id} attributes={attributes} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.attributes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No attributes assigned yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    group.attributes.map((a) => (
                      <TableRow key={a.code}>
                        <TableCell className="font-medium">{a.code}</TableCell>
                        <TableCell>{a.label}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{a.dataType}</Badge>
                        </TableCell>
                        <TableCell>{a.isRequired ? 'Yes' : '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
