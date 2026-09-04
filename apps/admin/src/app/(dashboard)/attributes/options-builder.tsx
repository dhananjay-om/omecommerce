'use client';

import { useRef, useState } from 'react';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OptionRow {
  key: string;
  value: string;
  label: string;
  /** Hex color, optional — only meaningful for a colour-style option. Powers
   *  the storefront's real "Colour" swatch filter (see filter-sidebar.tsx)
   *  once the attribute is reindexed; left unset, the filter falls back to
   *  a plain text checkbox, same as any other SELECT/MULTISELECT attribute. */
  swatch: string;
}

const DEFAULT_SWATCH = '#000000';

/** Repeatable value/label rows for SELECT/MULTISELECT attributes, serialized into a
 * hidden JSON input for plain FormData submission (matching the same idiom used for
 * `__attrTypes` in attribute-fields-section.tsx). */
export function OptionsBuilder() {
  const [rows, setRows] = useState<OptionRow[]>([]);
  const nextId = useRef(0);

  function addRow() {
    nextId.current += 1;
    setRows((prev) => [...prev, { key: `opt-${nextId.current}`, value: '', label: '', swatch: '' }]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateRow(key: string, field: 'value' | 'label' | 'swatch', text: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: text } : r)));
  }

  const serialized = JSON.stringify(
    rows
      .map((r) => ({ value: r.value, label: r.label, ...(r.swatch ? { swatch: r.swatch } : {}) }))
      .filter((o) => o.value && o.label),
  );

  return (
    <div className="space-y-2">
      <Label>Options</Label>
      <input type="hidden" name="options" value={serialized} />
      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <input
                type="color"
                title="Swatch colour (optional)"
                value={row.swatch || DEFAULT_SWATCH}
                onChange={(e) => updateRow(row.key, 'swatch', e.target.value)}
                className="h-9 w-9 shrink-0 cursor-pointer rounded border border-input p-0.5"
              />
              <Input placeholder="Value" value={row.value} onChange={(e) => updateRow(row.key, 'value', e.target.value)} />
              <Input placeholder="Label" value={row.label} onChange={(e) => updateRow(row.key, 'label', e.target.value)} />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeRow(row.key)}>
                <XIcon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        Add Option
      </Button>
    </div>
  );
}
