'use client';

import { useActionState } from 'react';
import { updateGstSettings, type ActionState } from './actions';
import type { Website } from '@/lib/types';
import { GST_STATES } from '@/lib/gst-states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialState: ActionState = { error: null, success: false };

export function GstSettingsForm({ website }: { website: Website }) {
  const [state, formAction, pending] = useActionState(updateGstSettings, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <input type="hidden" name="code" value={website.code} />
      <div className="space-y-2">
        <Label htmlFor={`gst-gstin-${website.code}`}>GSTIN</Label>
        <Input
          id={`gst-gstin-${website.code}`}
          name="gstin"
          maxLength={15}
          defaultValue={website.gstin ?? ''}
          placeholder="e.g. 27AAAAA0000A1Z5"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`gst-state-${website.code}`}>Origin state</Label>
        <Select name="originStateCode" defaultValue={website.originStateCode ?? ''}>
          <SelectTrigger id={`gst-state-${website.code}`} className="w-full">
            <SelectValue placeholder="Not set">
              {(value: string | null) => GST_STATES.find((s) => s.code === value)?.name ?? 'Not set'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {GST_STATES.map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Must match the GSTIN&apos;s first 2 digits.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`gst-pricesIncludeTax-${website.code}`}>Prices include tax</Label>
        <Select name="pricesIncludeTax" defaultValue={website.pricesIncludeTax ? 'true' : 'false'}>
          <SelectTrigger id={`gst-pricesIncludeTax-${website.code}`} className="w-full">
            <SelectValue>{(value: string) => (value === 'true' ? 'Yes — catalog prices are final (GST included)' : 'No — GST is added on top at checkout')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">No — GST is added on top at checkout</SelectItem>
            <SelectItem value="true">Yes — catalog prices are final (GST included)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          When on, every product/price-list price on this website is treated as the final, tax-inclusive price
          (MRP-style) — GST is backed out of it instead of added at checkout, so the price shown to shoppers is the
          price they pay.
        </p>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save GST Settings'}
      </Button>
    </form>
  );
}
