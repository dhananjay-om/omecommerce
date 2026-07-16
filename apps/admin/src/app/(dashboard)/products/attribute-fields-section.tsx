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
const NOT_EDITABLE_TYPES = new Set<AttributeDataType>([
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

export function AttributeFieldsSection({
  groups,
  values,
}: {
  groups: AttributeSetGroupDetail[];
  values: Record<string, unknown>;
}) {
  const attrTypes = buildAttrTypesMap(groups);
  const groupsWithFields = groups.filter((g) => g.attributes.some((a) => !NOT_EDITABLE_TYPES.has(a.dataType)));

  if (groupsWithFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 border-t pt-6">
      <input type="hidden" name="__attrTypes" value={JSON.stringify(attrTypes)} />
      {groupsWithFields.map((group) => (
        <div key={group.id} className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">{group.name}</h3>
          {group.attributes.map((attr) => {
            if (NOT_EDITABLE_TYPES.has(attr.dataType)) return null;
            const name = attributeInputName(attr.code);
            const current = values[attr.code];

            if (attr.dataType === 'BOOLEAN') {
              return (
                <div key={attr.code} className="flex items-center gap-2">
                  <input id={name} name={name} type="checkbox" className="size-4" defaultChecked={Boolean(current)} />
                  <Label htmlFor={name}>{attr.label}</Label>
                </div>
              );
            }

            if (attr.dataType === 'TEXTAREA' || attr.dataType === 'RICHTEXT') {
              return (
                <div key={attr.code} className="space-y-2">
                  <Label htmlFor={name}>{attr.label}</Label>
                  <Textarea id={name} name={name} defaultValue={current != null ? String(current) : ''} />
                </div>
              );
            }

            if (attr.dataType === 'SELECT') {
              const defaultValue = current != null ? String(current) : undefined;
              return (
                <div key={attr.code} className="space-y-2">
                  <Label htmlFor={name}>{attr.label}</Label>
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
                  <Label>{attr.label}</Label>
                  <div className="space-y-1.5">
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
                        <Label htmlFor={`${name}__${o.value}`}>{o.label}</Label>
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
                <Label htmlFor={name}>{attr.label}</Label>
                <Input
                  id={name}
                  name={name}
                  type={inputType}
                  step={attr.dataType === 'DECIMAL' ? 'any' : undefined}
                  defaultValue={current != null ? String(current) : ''}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
