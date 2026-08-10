import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { AttributeSet } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { NewAttributeSetDialog } from './new-attribute-set-dialog';
import { ListTree } from 'lucide-react';

export default async function AttributeSetsPage() {
  const sets = await apiGet<AttributeSet[]>('/admin/v1/attribute-sets');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attribute Sets</h1>
          <p className="text-sm text-muted-foreground">
            Group attributes into sets — a product picks one set, and every attribute assigned to it appears on
            that product&apos;s edit page.
          </p>
        </div>
        <NewAttributeSetDialog />
      </div>

      {sets.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No attribute sets yet — create one to start.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => (
            <Link key={s.id} href={`/attribute-sets/${s.id}`} className="block">
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ListTree className="size-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium leading-none">{s.name}</p>
                      {s.isDefault ? <Badge variant="success">Default</Badge> : null}
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">{s.code}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
