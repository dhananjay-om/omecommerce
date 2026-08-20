'use client';

import { useActionState, useState } from 'react';
import { updateAttribute, type ActionState } from './actions';
import type { Attribute } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';

const initialState: ActionState = { error: null, success: false };

/** Code/Data Type/Input Type stay read-only here — changing them after creation could invalidate
 *  already-stored values, same reasoning as Product's SKU/type being locked post-creation. Only the
 *  flags that actually caused this dialog to exist (Variant Forming most of all — see the "attribute
 *  created without it checked, now stuck as non-generatable" case) are editable. */
export function EditAttributeDialog({ attribute }: { attribute: Attribute }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateAttribute, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  const showVariantForming = attribute.dataType === 'SELECT' || attribute.dataType === 'MULTISELECT';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Edit ${attribute.label}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Attribute — {attribute.label}</DialogTitle>
          <DialogDescription>
            Code (<code className="font-mono">{attribute.code}</code>), Data Type ({attribute.dataType}), and Input
            Type can&apos;t be changed after creation. Everything else can.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={attribute.code} />
          <div className="space-y-2">
            <Label htmlFor={`edit-label-${attribute.code}`}>Label</Label>
            <Input id={`edit-label-${attribute.code}`} name="label" required defaultValue={attribute.label} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <input
                id={`edit-required-${attribute.code}`}
                name="isRequired"
                type="checkbox"
                className="size-4"
                defaultChecked={attribute.isRequired}
              />
              <Label htmlFor={`edit-required-${attribute.code}`}>Required</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id={`edit-filterable-${attribute.code}`}
                name="isFilterable"
                type="checkbox"
                className="size-4"
                defaultChecked={attribute.isFilterable}
              />
              <Label htmlFor={`edit-filterable-${attribute.code}`}>Filterable</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id={`edit-searchable-${attribute.code}`}
                name="isSearchable"
                type="checkbox"
                className="size-4"
                defaultChecked={attribute.isSearchable}
              />
              <Label htmlFor={`edit-searchable-${attribute.code}`}>Searchable</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id={`edit-comparable-${attribute.code}`}
                name="isComparable"
                type="checkbox"
                className="size-4"
                defaultChecked={attribute.isComparable}
              />
              <Label htmlFor={`edit-comparable-${attribute.code}`}>Comparable</Label>
            </div>
            {showVariantForming ? (
              <div className="flex items-center gap-2">
                <input
                  id={`edit-variant-forming-${attribute.code}`}
                  name="isVariantForming"
                  type="checkbox"
                  className="size-4"
                  defaultChecked={attribute.isVariantForming}
                />
                <Label htmlFor={`edit-variant-forming-${attribute.code}`}>Variant Forming</Label>
              </div>
            ) : null}
          </div>
          {showVariantForming ? (
            <p className="text-xs text-muted-foreground">
              Variant Forming attributes (like Size or Color) can be used to generate a configurable
              product&apos;s variants once assigned to its attribute set.
            </p>
          ) : null}
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
