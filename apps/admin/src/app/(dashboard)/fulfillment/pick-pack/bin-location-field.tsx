'use client';

import { useActionState } from 'react';
import { setBinLocation, type ActionState } from './actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const initialState: ActionState = { error: null, success: false };

export function BinLocationField({ sku, warehouseCode, binLocation }: { sku: string; warehouseCode: string; binLocation: string | null }) {
  const action = setBinLocation.bind(null, sku, warehouseCode);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <Input
        name="binLocation"
        defaultValue={binLocation ?? ''}
        placeholder="Unassigned"
        className="h-7 w-28 text-xs"
        aria-label={`Bin location for ${sku}`}
      />
      <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={pending}>
        {pending ? '…' : 'Save'}
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
