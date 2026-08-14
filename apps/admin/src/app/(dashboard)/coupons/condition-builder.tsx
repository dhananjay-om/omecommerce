'use client';

import { useState } from 'react';
import type { Attribute, AttributeOption, Category, CouponConditionType, CouponConditionView } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

/** One row's client-side working shape — a superset of every conditionType's
 *  fields, most left blank depending on which type is selected. Serialized to
 *  a single hidden JSON form field on submit; actions.ts resolves `sku` to a
 *  productId (publicId) server-side before hitting the coupon API (this app
 *  never exposes a browser-reachable product-search endpoint — see the
 *  Route Handler proxy this component's Attribute-Value fetch already needs). */
export interface ConditionRow {
  conditionType: CouponConditionType;
  sku: string;
  categoryId: string;
  attributeCode: string;
  attributeValue: string;
}

function emptyRow(): ConditionRow {
  return { conditionType: 'PRODUCT', sku: '', categoryId: '', attributeCode: '', attributeValue: '' };
}

/** Reconstructs the client working shape from a saved coupon's resolved conditions
 *  (edit mode) — productId there is already a publicId (SKU isn't roundtrippable
 *  from productId alone, so PRODUCT rows show productName as a read-only hint
 *  instead of a re-editable SKU input; re-typing the SKU replaces the reference). */
export function conditionRowsFromView(conditions: CouponConditionView[]): ConditionRow[] {
  return conditions.map((c) => ({
    conditionType: c.conditionType,
    sku: c.productName ?? c.productId ?? '',
    categoryId: c.categoryId ?? '',
    attributeCode: c.attributeCode ?? '',
    attributeValue: c.attributeValue ?? '',
  }));
}

function AttributeValueField({
  row,
  attributes,
  onChange,
}: {
  row: ConditionRow;
  attributes: Attribute[];
  onChange: (value: string) => void;
}) {
  const attribute = attributes.find((a) => a.code === row.attributeCode);
  const [options, setOptions] = useState<AttributeOption[] | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const isOptionBacked = attribute?.dataType === 'SELECT' || attribute?.dataType === 'MULTISELECT';

  if (isOptionBacked && attribute) {
    if (loadedFor !== attribute.code) {
      setLoadedFor(attribute.code);
      setOptions(null);
      fetch(`/api/attributes/${encodeURIComponent(attribute.code)}/options`)
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then((body: { data: AttributeOption[] }) => setOptions(body.data))
        .catch(() => setOptions([]));
    }
    return (
      <Select value={row.attributeValue} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={options === null ? 'Loading…' : 'Select a value'}>
            {(value: string | null) => (options ?? []).find((o) => o.id === value)?.label ?? (options === null ? 'Loading…' : 'Select a value')}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(options ?? []).map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return <Input value={row.attributeValue} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Cotton" required />;
}

export function ConditionBuilder({
  attributes,
  categories,
  initialRows,
}: {
  attributes: Attribute[];
  categories: Category[];
  initialRows?: ConditionRow[];
}) {
  const [rows, setRows] = useState<ConditionRow[]>(initialRows && initialRows.length > 0 ? initialRows : [emptyRow()]);

  function updateRow(index: number, patch: Partial<ConditionRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label>Conditions (a line must match every group below)</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
          Add condition
        </Button>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[140px_1fr_auto] items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Match</Label>
            <Select value={row.conditionType} onValueChange={(v) => updateRow(i, { conditionType: v as CouponConditionType })}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: CouponConditionType) =>
                    value === 'PRODUCT' ? 'Product (SKU)' : value === 'CATEGORY' ? 'Category' : 'Attribute'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRODUCT">Product (SKU)</SelectItem>
                <SelectItem value="CATEGORY">Category</SelectItem>
                <SelectItem value="ATTRIBUTE">Attribute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {row.conditionType === 'PRODUCT' ? (
            <div className="space-y-1">
              <Label className="text-xs">SKU</Label>
              <Input value={row.sku} onChange={(e) => updateRow(i, { sku: e.target.value })} placeholder="e.g. DEMO-TSHIRT" required />
            </div>
          ) : row.conditionType === 'CATEGORY' ? (
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={row.categoryId} onValueChange={(v) => updateRow(i, { categoryId: v ?? '' })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category">
                    {(value: string | null) => categories.find((c) => c.publicId === value)?.nameDefault ?? categories.find((c) => c.publicId === value)?.publicId ?? 'Select a category'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.publicId} value={c.publicId}>
                      {c.nameDefault ?? c.publicId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Attribute</Label>
                <Select value={row.attributeCode} onValueChange={(v) => updateRow(i, { attributeCode: v ?? '', attributeValue: '' })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an attribute">
                      {(value: string | null) => attributes.find((a) => a.code === value)?.label ?? 'Select an attribute'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {attributes.map((a) => (
                      <SelectItem key={a.code} value={a.code}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value</Label>
                {row.attributeCode ? (
                  <AttributeValueField row={row} attributes={attributes} onChange={(v) => updateRow(i, { attributeValue: v })} />
                ) : (
                  <Input disabled placeholder="Pick an attribute first" />
                )}
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove condition"
            disabled={rows.length === 1}
            onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <input type="hidden" name="conditionsJson" value={JSON.stringify(rows)} />
    </div>
  );
}
