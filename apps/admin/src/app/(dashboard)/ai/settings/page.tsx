import { Settings, AlertTriangle } from 'lucide-react';
import { apiGet, ApiError } from '@/lib/api-client';
import type { AiSettings } from '@/lib/types';
import { AiSettingsForm } from './ai-settings-form';
import { Card, CardContent } from '@/components/ui/card';

/** An unguarded `apiGet` here would crash the whole Server Component behind
 *  Next's generic error screen on ANY failure — the same bug found and
 *  fixed on the Dashboard earlier (see dashboard/page.tsx's safeFetch) —
 *  but a settings page shouldn't just silently degrade to an empty form
 *  either: that would look like "no key saved yet" when the real problem
 *  is e.g. the new `ai:manage` permission not being synced/relogged-in
 *  yet. So this catches the specific failure and surfaces an actionable
 *  message instead of either extreme. */
async function loadSettings(): Promise<{ settings: AiSettings | null; error: string | null }> {
  try {
    return { settings: await apiGet<AiSettings | null>('/admin/v1/ai/settings'), error: null };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return {
        settings: null,
        error:
          "You don't have permission to view AI Settings yet. Go to Stores > Admin Permissions and click Sync, then log out and back in — this page needs the new \"ai:manage\" permission, which your session won't have until you do that.",
      };
    }
    return { settings: null, error: `Couldn't load AI settings (${err instanceof ApiError ? err.message : 'unknown error'}). If this just deployed, confirm the migration ran — see deploy/deploy-ai-settings.sh.` };
  }
}

export default async function AiSettingsPage() {
  const { settings, error } = await loadSettings();

  return (
    <div>
      <div>
        <h1 className="flex items-center gap-2 text-[1.32rem] font-extrabold tracking-tight">
          <Settings className="size-5 text-primary" />
          AI Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the LLM provider key used by AI features. Saving here takes effect immediately — no restart
          or redeploy needed.
        </p>
      </div>

      <div className="mt-6">
        {error ? (
          <Card className="max-w-xl border-destructive/30">
            <CardContent className="flex items-start gap-3 pt-4 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p>{error}</p>
            </CardContent>
          </Card>
        ) : (
          <AiSettingsForm settings={settings} />
        )}
      </div>
    </div>
  );
}
