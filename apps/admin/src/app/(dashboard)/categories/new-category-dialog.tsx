'use client';

import { useActionState, useState } from 'react';
import { Plus } from 'lucide-react';
import { createCategory, type ActionState } from './actions';
import type { Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const ROOT_VALUE = '__root__';

/** Depth-prefixed labels ("— Laptops") so the flat picker still conveys the tree shape. */
function withDepthLabels(categories: Category[]): Array<{ publicId: string; label: string }> {
  const byId = new Map(categories.map((c) => [c.publicId, c]));
  function depthOf(c: Category): number {
    let depth = 0;
    let current = c.parentId ? byId.get(c.parentId) : undefined;
    while (current) {
      depth += 1;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return depth;
  }
  return categories.map((c) => ({
    publicId: c.publicId,
    label: `${'— '.repeat(depthOf(c))}${c.nameDefault ?? '(untitled)'}`,
  }));
}

const initialState: ActionState = { error: null, success: false };

export function NewCategoryDialog({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState(ROOT_VALUE);
  const [state, formAction, pending] = useActionState(createCategory, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  const options = withDepthLabels(categories);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-3.5" />
            Add Category
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" name="nameDefault" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-parent">Parent</Label>
            <input type="hidden" name="parentId" value={parentId === ROOT_VALUE ? '' : parentId} />
            <Select value={parentId} onValueChange={(value) => setParentId(String(value))}>
              <SelectTrigger id="cat-parent" className="w-full">
                <SelectValue placeholder="— Root —">
                  {(value: string | null) =>
                    value === ROOT_VALUE || !value ? '— Root —' : options.find((o) => o.publicId === value)?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT_VALUE}>— Root —</SelectItem>
                {options.map((o) => (
                  <SelectItem key={o.publicId} value={o.publicId}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
