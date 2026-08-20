import { apiGet } from '@/lib/api-client';
import type { EmailSettings } from '@/lib/types';
import { EmailSettingsForm } from './email-settings-form';

export default async function EmailSettingsPage() {
  const settings = await apiGet<EmailSettings | null>('/admin/v1/email-settings');

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email (SMTP)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the mailbox order confirmation, shipment, cancellation, and refund emails send
          from. Saving here takes effect immediately — no restart or redeploy needed.
        </p>
      </div>

      <div className="mt-6">
        <EmailSettingsForm settings={settings} />
      </div>
    </div>
  );
}
