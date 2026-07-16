'use client';

import { useActionState, useState } from 'react';
import { assignAttributeToGroup, type ActionState } from '../actions';
import type { Attribute } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function AssignAttributeDialog({
  attributeSetId,
  groupId,
  attributes,
}: {
  attributeSetId: string;
  groupId: string;
  attributes: Attribute[];
}) {
  const [open, setOpen] = useState(false);
  const [attributeCode, setAttributeCode] = useState(attributes[0]?.code ?? '');
  const [state, formAction, pending] = useActionState(assignAttributeToGroup, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

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
          <div className="space-y-2">
            <Label htmlFor="assign-attribute">Attribute</Label>
            {attributes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reusable attributes exist yet — create one on the Attributes page first.
              </p>
            ) : (
              <Select name="attributeCode" value={attributeCode} onValueChange={(value) => setAttributeCode(String(value))}>
                <SelectTrigger id="assign-attribute" className="w-full">
                  <SelectValue placeholder="Select an attribute">
                    {(value: string | null) => attributes.find((a) => a.code === value)?.label ?? 'Select an attribute'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {attributes.map((a) => (
                    <SelectItem key={a.code} value={a.code}>
                      {a.label} ({a.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="assign-sort">Sort Order</Label>
            <Input id="assign-sort" name="sortOrder" type="number" step="1" defaultValue={0} />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || attributes.length === 0}>
              {pending ? 'Assigning…' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
