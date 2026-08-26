'use client';

import type { AttributeDataType, AttributeSetGroupDetail } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const INPUT_NAME_PREFIX = 'attr__';

/** Types with no editor in this pass: IMAGE/FILE need real upload plumbing (a
 * future phase — see plan/13's out-of-scope list), JSON has no defined shape to
 * render generically, and REF_* are foreign keys into other entities (products,
 * categories, brands, CMS, collections, customers) that would need a picker UI. */
export const NOT_EDITABLE_TYPES = new Set<AttributeDataType>([
  'IMAGE',
  'FILE',
  'JSON',
  'REF_PRODUCT',
  'REF_CATEGORY',
  'REF_BRAND',
  'REF_CMS',
  'REF_COLLECTION',
  'REF_CUSTOMER',
]);

export function attributeInputName(code: string): string {
  return `${INPUT_NAME_PREFIX}${code}`;
}

/** Maps each rendered attribute's code to its data type, so the Server Action
 * knows how to read that field back out of the submitted FormData (a plain
 * `<input>` can't tell you its own semantic type). */
function buildAttrTypesMap(groups: AttributeSetGroupDetail[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const group of groups) {
    for (const attr of group.attributes) {
      if (NOT_EDITABLE_TYPES.has(attr.dataType)) continue;
      map[attr.code] = attr.dataType;
    }
  }
  return map;
}

/** Label with a red asterisk when the attribute is required on its set. */
function FieldLabel({ htmlFor, attr }: { htmlFor?: string; attr: { label: string; isRequired: boolean } }) {
  return (
    <Label htmlFor={htmlFor}>
      {attr.label}
      {attr.isRequired ? <span className="ml-0.5 text-destructive">*</span> : null}
    </Label>
  );
}

export function AttributeFieldsSection({
  groups,
  values,
  renderFieldAction,
}: {
  groups: AttributeSetGroupDetail[];
  values: Record<string, unknown>;
  /** Optional per-field action slot (e.g. an AI "Generate" button) shown
   *  next to a TEXTAREA/RICHTEXT field's label, keyed by attribute code —
   *  return null/undefined for codes that don't need one. Keeps this
   *  component generic (it renders ANY attribute set's fields, most of
   *  which have no such action) while letting a specific caller (the
   *  Overview form, for Description/Short Description) opt in without
   *  this component needing to know anything about AI. */
  renderFieldAction?: (code: string) => React.ReactNode;
}) {
  const attrTypes = buildAttrTypesMap(groups);
  const groupsWithAttributes = groups.filter((g) => g.attributes.length > 0);

  if (groupsWithAttributes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <input type="hidden" name="__attrTypes" value={JSON.stringify(attrTypes)} />
      {groupsWithAttributes.map((group) => (
        <div key={group.id} className="rounded-lg border bg-muted/20 p-4">
          <h3 className="mb-4 text-sm font-semibold text-foreground">{group.name}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.attributes.map((attr) => {
              if (NOT_EDITABLE_TYPES.has(attr.dataType)) {
                return (
                  <div key={attr.code} className="space-y-2">
                    <FieldLabel attr={attr} />
                    <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {attr.dataType} attributes aren&apos;t editable from this page yet.
                    </p>
                  </div>
                );
              }

              const name = attributeInputName(attr.code);
              const current = values[attr.code];

              if (attr.dataType === 'BOOLEAN') {
                return (
                  <div key={attr.code} className="flex items-center gap-2 self-end pb-2">
                    <input id={name} name={name} type="checkbox" className="size-4" defaultChecked={Boolean(current)} />
                    <FieldLabel htmlFor={name} attr={attr} />
                  </div>
                );
              }

              if (attr.dataType === 'TEXTAREA' || attr.dataType === 'RICHTEXT') {
                const fieldAction = renderFieldAction?.(attr.code);
                return (
                  <div key={attr.code} className="space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor={name} attr={attr} />
                      {fieldAction}
                    </div>
                    <Textarea id={name} name={name} defaultValue={current != null ? String(current) : ''} />
                  </div>
                );
              }

              if (attr.dataType === 'SELECT') {
                const defaultValue = current != null ? String(current) : undefined;
                return (
                  <div key={attr.code} className="space-y-2">
                    <FieldLabel htmlFor={name} attr={attr} />
                    <Select name={name} defaultValue={defaultValue}>
                      <SelectTrigger id={name} className="w-full">
                        <SelectValue placeholder={`Select ${attr.label}`}>
                          {(value: string | null) => attr.options.find((o) => o.id === value)?.label ?? `Select ${attr.label}`}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {attr.options.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (attr.dataType === 'MULTISELECT') {
                const currentValues = Array.isArray(current) ? current.map(String) : [];
                return (
                  <div key={attr.code} className="space-y-2">
                    <FieldLabel attr={attr} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border px-3 py-2">
                      {attr.options.map((o) => (
                        <div key={o.id} className="flex items-center gap-2">
                          <input
                            id={`${name}__${o.value}`}
                            name={name}
                            type="checkbox"
                            value={o.value}
                            className="size-4"
                            defaultChecked={currentValues.includes(o.value)}
                          />
                          <Label htmlFor={`${name}__${o.value}`} className="font-normal">
                            {o.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              const inputType =
                attr.dataType === 'NUMBER'
                  ? 'number'
                  : attr.dataType === 'DECIMAL'
                    ? 'number'
                    : attr.dataType === 'DATE'
                      ? 'date'
                      : attr.dataType === 'DATETIME'
                        ? 'datetime-local'
                        : attr.dataType === 'COLOR'
                          ? 'color'
                          : attr.dataType === 'EMAIL'
                            ? 'email'
                            : attr.dataType === 'URL'
                              ? 'url'
                              : 'text';

              return (
                <div key={attr.code} className="space-y-2">
                  <FieldLabel htmlFor={name} attr={attr} />
                  <Input
                    id={name}
                    name={name}
                    type={inputType}
                    step={attr.dataType === 'DECIMAL' ? 'any' : undefined}
                    defaultValue={current != null ? String(current) : ''}
                    className={inputType === 'color' ? 'h-10 w-20 p-1' : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
