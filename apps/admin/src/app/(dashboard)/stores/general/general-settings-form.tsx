'use client';

import { useActionState } from 'react';
import { updateGeneralSettings, type ActionState } from './actions';
import { LogoUploadField } from './logo-upload-field';
import type { Website } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const initialState: ActionState = { error: null, success: false };

export function GeneralSettingsForm({ website }: { website: Website }) {
  const [state, formAction, pending] = useActionState(updateGeneralSettings, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <input type="hidden" name="code" value={website.code} />
      <LogoUploadField code={website.code} initialLogoUrl={website.logoUrl} />
      <div className="space-y-2">
        <Label htmlFor={`general-address-${website.code}`}>Store Address</Label>
        <Textarea
          id={`general-address-${website.code}`}
          name="address"
          rows={3}
          defaultValue={website.address ?? ''}
          placeholder={'123 Business Park\nAndheri East, Mumbai, Maharashtra 400069\nIndia'}
        />
        <p className="text-xs text-muted-foreground">Printed on the invoice letterhead — one line per address line.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`general-email-${website.code}`}>Store Email</Label>
        <Input
          id={`general-email-${website.code}`}
          name="supportEmail"
          type="email"
          defaultValue={website.supportEmail ?? ''}
          placeholder="support@yourstore.com"
        />
        <p className="text-xs text-muted-foreground">Shown to customers as your store&apos;s contact address.</p>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save General Settings'}
      </Button>
    </form>
  );
}
