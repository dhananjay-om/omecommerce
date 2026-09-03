'use client';

import { useEffect, useRef, useState } from 'react';
import { XIcon } from 'lucide-react';
import { getAttributeOptions } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OptionRow {
  key: string;
  id?: string;
  value: string;
  label: string;
}

/** The edit-dialog counterpart to OptionsBuilder (new-attribute-dialog.tsx) — that one only
 *  ever builds brand-new rows, since a SELECT/MULTISELECT attribute's options used to be
 *  create-time-only. This one fetches what already exists for `code` (via the standalone
 *  GET /attributes/:code/options route) and pre-fills editable rows for them, each carrying
 *  its real `id` so the update action can tell the backend "update this row" vs "create a new
 *  one" — same {id?, value, label} shape PUT /attributes/:code/options expects, serialized
 *  into the same hidden `options` input the parent form already knows how to submit. */
export function EditOptionsEditor({ code }: { code: string }) {
  const [rows, setRows] = useState<OptionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getAttributeOptions(code)
      .then((options) => {
        if (cancelled) return;
        setRows(
          options.map((o) => ({ key: `existing-${o.id}`, id: o.id, value: o.value, label: o.label })),
        );
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load existing options.');
      });
    return () => {
      cancelled = true;
    };
    // Fetch once, when this attribute's edit dialog mounts — code is fixed per dialog instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addRow() {
    nextId.current += 1;
    setRows((prev) => [...(prev ?? []), { key: `new-${nextId.current}`, value: '', label: '' }]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev ?? []).filter((r) => r.key !== key));
  }

  function updateRow(key: string, field: 'value' | 'label', text: string) {
    setRows((prev) => (prev ?? []).map((r) => (r.key === key ? { ...r, [field]: text } : r)));
  }

  const serialized = JSON.stringify(
    (rows ?? [])
      .map((r) => ({ id: r.id, value: r.value, label: r.label }))
      .filter((o) => o.value && o.label),
  );

  return (
    <div className="space-y-2">
      <Label>Options</Label>
      <input type="hidden" name="options" value={serialized} />
      {rows === null ? (
        <p className="text-sm text-muted-foreground">{loadError ?? 'Loading existing options…'}</p>
      ) : (
        <>
          {rows.length > 0 ? (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                  <Input placeholder="Value" value={row.value} onChange={(e) => updateRow(row.key, 'value', e.target.value)} />
                  <Input placeholder="Label" value={row.label} onChange={(e) => updateRow(row.key, 'label', e.target.value)} />
                  {/* Only a not-yet-saved row can be removed here — an existing option (has an
                      id) may already be used by a real product/variant, so this editor only
                      ever adds or edits, never deletes; an X here would be a lie for that row. */}
                  {row.id ? (
                    <span className="size-7 shrink-0" aria-hidden />
                  ) : (
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeRow(row.key)}>
                      <XIcon className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No options yet.</p>
          )}
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            Add Option
          </Button>
        </>
      )}
    </div>
  );
}
