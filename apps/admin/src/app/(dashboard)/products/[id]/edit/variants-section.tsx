'use client';

import { useActionState, useState } from 'react';
import { generateVariants, type GenerateVariantsState } from './variants-actions';
import type { AttributeSetGroupDetail, Variant } from '@/lib/types';

const initialGenerateState: GenerateVariantsState = { error: null, result: null };
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EditVariantDialog } from './edit-variant-dialog';
import { DeleteVariantDialog } from './delete-variant-dialog';

/** Eligible variant axes: SELECT attributes assigned to this product's attribute set and
 * flagged "variant forming" — mirrors exactly what the backend's GenerateProductVariants
 * validates, so nothing the admin picks here can be rejected server-side. */
function eligibleAxes(groups: AttributeSetGroupDetail[]) {
  return groups.flatMap((g) => g.attributes).filter((a) => a.isVariantForming && a.dataType === 'SELECT');
}

export function VariantsSection({
  productPublicId,
  groups,
  variants,
}: {
  productPublicId: string;
  groups: AttributeSetGroupDetail[];
  variants: Variant[];
}) {
  const axes = eligibleAxes(groups);
  const action = generateVariants.bind(null, productPublicId);
  const [state, formAction, pending] = useActionState(action, initialGenerateState);
  const [selectedAxes, setSelectedAxes] = useState<Set<string>>(new Set());

  function toggleAxis(code: string) {
    setSelectedAxes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {axes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No variant-forming SELECT attributes (like Size or Color) are assigned to this product&apos;s
          attribute set yet. Create one on the Attributes page with &quot;Variant Forming&quot; checked,
          then assign it to this set, to generate variants here.
        </p>
      ) : (
        <form action={formAction} className="space-y-4 rounded-lg border bg-muted/20 p-4">
          <h4 className="text-sm font-semibold">Generate Variants</h4>
          <p className="text-xs text-muted-foreground">
            Pick which attributes define this product&apos;s variants and which of their values to
            include — every combination gets created at once, with an auto-built SKU.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {axes.map((attr) => (
              <div key={attr.code} className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={selectedAxes.has(attr.code)}
                    onChange={() => toggleAxis(attr.code)}
                  />
                  {attr.label}
                </label>
                {selectedAxes.has(attr.code) ? (
                  <div className="ml-6 flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border px-3 py-2">
                    {attr.options.map((o) => (
                      <label key={o.id} className="flex items-center gap-1.5 text-sm font-normal">
                        <input type="checkbox" name={`axis__${attr.code}`} value={o.id} className="size-4" defaultChecked />
                        {o.label}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.result ? (
            <p className="text-sm text-success">
              Created {state.result.created} variant{state.result.created === 1 ? '' : 's'}
              {state.result.skipped > 0 ? ` — ${state.result.skipped} combination${state.result.skipped === 1 ? '' : 's'} already existed and were skipped` : ''}
              .
            </p>
          ) : null}
          <Button type="submit" disabled={pending || selectedAxes.size === 0}>
            {pending ? 'Generating…' : 'Generate Variants'}
          </Button>
        </form>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Axis Values</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No variants yet — generate some above.
                </TableCell>
              </TableRow>
            ) : (
              variants.map((v) => (
                <TableRow key={v.publicId}>
                  <TableCell className="font-mono text-sm font-medium">{v.sku}</TableCell>
                  <TableCell>
                    {v.axisValues.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {v.axisValues.map((a) => (
                          <Badge key={a.attributeCode} variant="outline">
                            {a.attributeLabel}: {a.optionLabel}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.status === 'ACTIVE' ? 'success' : 'secondary'}>{v.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <EditVariantDialog productPublicId={productPublicId} variant={v} />
                      <DeleteVariantDialog productPublicId={productPublicId} variant={v} />
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
