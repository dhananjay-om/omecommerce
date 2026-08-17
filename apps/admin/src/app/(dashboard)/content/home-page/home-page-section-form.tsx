'use client';

import { useActionState, useState } from 'react';
import { X } from 'lucide-react';
import type { ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SectionFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

type Row = Record<string, string>;

const initialState: ActionState = { error: null, success: false };

/**
 * One reusable repeatable-row editor for all four Home Page sections (Hero
 * Banner slides, Promo Banners, Why Choose Us features, Testimonials) —
 * each is just a list of flat text/select rows under the hood, so one
 * field-schema-driven component covers all of them instead of four
 * near-duplicate ones. Same add/remove-row + hidden-JSON-on-submit pattern
 * as coupons/condition-builder.tsx.
 */
export function HomePageSectionForm({
  title,
  description,
  fields,
  initialRows,
  hiddenFieldName,
  action,
  addLabel,
}: {
  title: string;
  description: string;
  fields: SectionFieldDef[];
  initialRows: Row[];
  hiddenFieldName: string;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  addLabel: string;
}) {
  function emptyRow(): Row {
    return Object.fromEntries(fields.map((f) => [f.key, f.options?.[0]?.value ?? '']));
  }

  const [state, formAction, pending] = useActionState(action, initialState);
  const [rows, setRows] = useState<Row[]>(initialRows.length > 0 ? initialRows : [emptyRow()]);

  function updateRow(index: number, key: string, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <form action={formAction} className="space-y-4">
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Row {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remove row"
                    disabled={rows.length === 1}
                    onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs">{f.label}</Label>
                      {f.type === 'select' ? (
                        <Select value={row[f.key] ?? ''} onValueChange={(v) => updateRow(i, f.key, v ?? '')}>
                          <SelectTrigger className="w-full">
                            <SelectValue>{(value: string) => f.options?.find((o) => o.value === value)?.label ?? value}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {f.options?.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : f.type === 'textarea' ? (
                        <Textarea rows={2} value={row[f.key] ?? ''} onChange={(e) => updateRow(i, f.key, e.target.value)} placeholder={f.placeholder} />
                      ) : (
                        <Input value={row[f.key] ?? ''} onChange={(e) => updateRow(i, f.key, e.target.value)} placeholder={f.placeholder} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
            {addLabel}
          </Button>
          <input type="hidden" name={hiddenFieldName} value={JSON.stringify(rows)} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-success">Saved — live on the homepage.</p> : null}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
