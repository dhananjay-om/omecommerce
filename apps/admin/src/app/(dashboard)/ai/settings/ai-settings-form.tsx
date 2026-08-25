'use client';

import { useActionState } from 'react';
import { updateAiSettings, testAiConnection, type ActionState, type TestConnectionState } from './actions';
import type { AiSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const initialState: ActionState = { error: null, success: false };
const initialTestState: TestConnectionState = { error: null, success: false, model: null };
const MODEL_OPTIONS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-3.5-turbo'];

/** OpenAI key form + a separate "Test API Key" form — same "two independent
 *  useActionState instances, not one" reasoning as EmailSettingsForm (the
 *  precedent this mirrors): saving shouldn't block on, or be blocked by, a
 *  separate connectivity check. No feature reads this saved key yet — see
 *  ai.prisma's AiSettings doc comment — this page is purely the
 *  key-management plumbing AI Assistant (and friends) will use later. */
export function AiSettingsForm({ settings }: { settings: AiSettings | null }) {
  const [state, formAction, pending] = useActionState(updateAiSettings, initialState);
  const [testState, testAction, testPending] = useActionState(testAiConnection, initialTestState);

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">OpenAI</CardTitle>
          <CardDescription>
            The key used for LLM-based AI features (AI Assistant and beyond — nothing reads this yet).
            Get a key from{' '}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline underline-offset-2">
              platform.openai.com/api-keys
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="as-api-key">API Key</Label>
              <Input
                id="as-api-key"
                name="apiKey"
                type="password"
                autoComplete="off"
                required={!settings?.hasApiKey}
                placeholder={settings?.hasApiKey ? 'Leave blank to keep the current key' : 'sk-...'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="as-model">Model</Label>
              <select
                id="as-model"
                name="model"
                defaultValue={settings?.model ?? 'gpt-4o-mini'}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input id="as-active" name="isActive" type="checkbox" defaultChecked={settings?.isActive ?? true} className="size-4" />
              <Label htmlFor="as-active" className="cursor-pointer font-normal">
                Enabled — AI features use this key while checked; uncheck to pause without deleting it
              </Label>
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            {state.success ? <p className="text-sm text-success">Saved.</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Test API Key</CardTitle>
          <CardDescription>
            Confirms the currently-saved key actually authenticates with OpenAI — a real API call, not just a
            format check.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form action={testAction}>
            <Button type="submit" variant="outline" disabled={testPending}>
              {testPending ? 'Testing…' : 'Test API Key'}
            </Button>
          </form>
          {testState.error ? <p className="mt-2 text-sm text-destructive">{testState.error}</p> : null}
          {testState.success ? <p className="mt-2 text-sm text-success">Connected — {testState.model} is reachable.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
