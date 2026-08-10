'use client';

import { useActionState, useMemo, useState } from 'react';
import { assignAttributeToGroup, type ActionState } from '../actions';
import type { Attribute } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function AssignAttributeDialog({
  attributeSetId,
  groupId,
  attributes,
  assignedCodes,
}: {
  attributeSetId: string;
  groupId: string;
  attributes: Attribute[];
  /** Codes already assigned somewhere in this set — shown but not selectable, so nothing gets silently double-assigned. */
  assignedCodes: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [attributeCode, setAttributeCode] = useState('');
  const [state, formAction, pending] = useActionState(assignAttributeToGroup, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) {
      setOpen(false);
      setAttributeCode('');
      setQuery('');
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return attributes;
    return attributes.filter((a) => a.code.toLowerCase().includes(q) || a.label.toLowerCase().includes(q));
  }, [attributes, query]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">Assign Attribute</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Attribute</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="attributeSetId" value={attributeSetId} />
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="attributeCode" value={attributeCode} />
          <div className="space-y-2">
            <Label htmlFor="assign-search">Attribute</Label>
            {attributes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reusable attributes exist yet — create one on the Attributes page first.
              </p>
            ) : (
              <>
                <Input
                  id="assign-search"
                  placeholder="Search by code or label…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="max-h-56 overflow-y-auto rounded-md border">
                  {filtered.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No attributes match &quot;{query}&quot;.</p>
                  ) : (
                    filtered.map((a) => {
                      const alreadyAssigned = assignedCodes.has(a.code);
                      const isSelected = attributeCode === a.code;
                      return (
                        <button
                          key={a.code}
                          type="button"
                          disabled={alreadyAssigned}
                          onClick={() => setAttributeCode(a.code)}
                          className={`flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 disabled:cursor-not-allowed disabled:opacity-50 ${
                            isSelected ? 'bg-primary/10' : 'hover:bg-muted/60'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{a.label}</span>
                            <span className="block truncate font-mono text-xs text-muted-foreground">{a.code}</span>
                          </span>
                          {alreadyAssigned ? (
                            <Badge variant="secondary" className="shrink-0">
                              Assigned
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0">
                              {a.dataType}
                            </Badge>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="assign-sort">Sort Order</Label>
            <Input id="assign-sort" name="sortOrder" type="number" step="1" defaultValue={0} />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || !attributeCode}>
              {pending ? 'Assigning…' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
