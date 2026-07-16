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
}

/** Repeatable value/label rows for SELECT/MULTISELECT attributes, serialized into a
 * hidden JSON input for plain FormData submission (matching the same idiom used for
 * `__attrTypes` in attribute-fields-section.tsx). */
export function OptionsBuilder() {
  const [rows, setRows] = useState<OptionRow[]>([]);
  const nextId = useRef(0);

  function addRow() {
    nextId.current += 1;
    setRows((prev) => [...prev, { key: `opt-${nextId.current}`, value: '', label: '' }]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateRow(key: string, field: 'value' | 'label', text: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: text } : r)));
  }

  const serialized = JSON.stringify(
    rows.map((r) => ({ value: r.value, label: r.label })).filter((o) => o.value && o.label),
  );

  return (
    <div className="space-y-2">
      <Label>Options</Label>
      <input type="hidden" name="options" value={serialized} />
      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
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
