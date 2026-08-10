'use client';

import { useActionState, useState } from 'react';
import { updateWarehouse, type ActionState } from '../actions';
import type { Warehouse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const WAREHOUSE_TYPES = ['PHYSICAL', 'VIRTUAL', 'DROPSHIP'];

const initialState: ActionState = { error: null, success: false };

export function EditWarehouseDialog({ warehouse }: { warehouse: Warehouse }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateWarehouse, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Warehouse — {warehouse.code}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={warehouse.code} />
          <div className="space-y-2">
            <Label>Code</Label>
            <Input value={warehouse.code} disabled />
            <p className="text-xs text-muted-foreground">Code can&apos;t be changed after creation.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`ewh-name-${warehouse.code}`}>Name</Label>
            <Input id={`ewh-name-${warehouse.code}`} name="name" required defaultValue={warehouse.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`ewh-type-${warehouse.code}`}>Type</Label>
            <Select name="type" defaultValue={warehouse.type}>
              <SelectTrigger id={`ewh-type-${warehouse.code}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAREHOUSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`ewh-priority-${warehouse.code}`}>Priority</Label>
            <Input
              id={`ewh-priority-${warehouse.code}`}
              name="priority"
              type="number"
              step="1"
              defaultValue={warehouse.priority}
            />
            <p className="text-xs text-muted-foreground">
              Higher priority warehouses are preferred when fulfilling an order from several locations.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`ewh-active-${warehouse.code}`}>Status</Label>
            <Select name="isActive" defaultValue={warehouse.isActive ? 'true' : 'false'}>
              <SelectTrigger id={`ewh-active-${warehouse.code}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Inactive warehouses are hidden from product pricing/stock views but keep their history.
            </p>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
