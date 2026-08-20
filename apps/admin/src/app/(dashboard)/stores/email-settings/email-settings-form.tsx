'use client';

import { useActionState } from 'react';
import { updateEmailSettings, sendTestEmail, type ActionState, type TestEmailState } from './actions';
import type { EmailSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const initialState: ActionState = { error: null, success: false };
const initialTestState: TestEmailState = { error: null, success: false };

/** SMTP settings form + a separate "Send Test Email" form — kept as two
 *  independent useActionState instances (two forms) rather than one, since
 *  they're two unrelated server calls with their own pending/result state:
 *  saving settings shouldn't block on (or be blocked by) sending a test. */
export function EmailSettingsForm({ settings }: { settings: EmailSettings | null }) {
  const [state, formAction, pending] = useActionState(updateEmailSettings, initialState);
  const [testState, testAction, testPending] = useActionState(sendTestEmail, initialTestState);

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">SMTP Settings</CardTitle>
          <CardDescription>
            Used to send order confirmation, shipment, cancellation, and refund emails. For Gmail or
            Google Workspace, Username is the full address and Password must be an{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              App Password
            </a>{' '}
            — Gmail rejects your normal account password over SMTP.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form action={formAction} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="es-host">Host</Label>
                <Input id="es-host" name="host" required defaultValue={settings?.host ?? 'smtp.gmail.com'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="es-port">Port</Label>
                <Input id="es-port" name="port" required defaultValue={settings?.port ?? 587} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="es-username">Username (email address)</Label>
              <Input
                id="es-username"
                name="username"
                type="email"
                required
                defaultValue={settings?.username ?? ''}
                placeholder="orders@yourstore.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="es-password">Password (App Password)</Label>
              <Input
                id="es-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required={!settings?.hasPassword}
                placeholder={settings?.hasPassword ? 'Leave blank to keep the current password' : '16-character App Password'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="es-from-name">From name (optional)</Label>
                <Input id="es-from-name" name="fromName" defaultValue={settings?.fromName ?? ''} placeholder="Your Store" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="es-from-email">From address (optional)</Label>
                <Input
                  id="es-from-email"
                  name="fromEmail"
                  type="email"
                  defaultValue={settings?.fromEmail ?? ''}
                  placeholder="Defaults to Username above"
                />
              </div>
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            {state.success ? <p className="text-sm text-success">Saved.</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save SMTP Settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Send Test Email</CardTitle>
          <CardDescription>
            Sends a real email through whichever settings are currently active (the ones saved above,
            or the server&apos;s own configuration if none are saved yet) — confirms your credentials
            actually work before relying on them for real orders.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form action={testAction} className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="es-test-to">Send to</Label>
              <Input id="es-test-to" name="to" type="email" required placeholder="you@example.com" />
            </div>
            <Button type="submit" variant="outline" disabled={testPending}>
              {testPending ? 'Sending…' : 'Send Test Email'}
            </Button>
          </form>
          {testState.error ? <p className="mt-2 text-sm text-destructive">{testState.error}</p> : null}
          {testState.success ? (
            <p className="mt-2 text-sm text-success">Sent — check the inbox (and spam folder).</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
