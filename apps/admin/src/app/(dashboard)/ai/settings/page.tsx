import { Settings } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import type { AiSettings } from '@/lib/types';
import { AiSettingsForm } from './ai-settings-form';

export default async function AiSettingsPage() {
  const settings = await apiGet<AiSettings | null>('/admin/v1/ai/settings');

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
        <AiSettingsForm settings={settings} />
      </div>
    </div>
  );
}
