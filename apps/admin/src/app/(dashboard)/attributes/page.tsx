import { apiGet } from '@/lib/api-client';
import type { Attribute } from '@/lib/types';
import { AttributesGrid } from './attributes-grid';
import { NewAttributeDialog } from './new-attribute-dialog';

export default async function AttributesPage() {
  const attributes = await apiGet<Attribute[]>('/admin/v1/attributes');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attributes</h1>
          <p className="text-sm text-muted-foreground">
            The reusable attribute library — create attributes here, then assign them into Attribute Sets.
          </p>
        </div>
        <NewAttributeDialog />
      </div>

      <AttributesGrid attributes={attributes} />
    </div>
  );
}
