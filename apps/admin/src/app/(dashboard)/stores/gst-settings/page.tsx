import { apiGet } from '@/lib/api-client';
import type { Website } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GstSettingsForm } from './gst-settings-form';

export default async function GstSettingsPage() {
  const websites = await apiGet<Website[]>('/admin/v1/websites');

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">GST Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This website&apos;s own GST registration — compared against a shipping address&apos;s state to decide
          CGST+SGST (same state) vs IGST (different state) at checkout. Single-registration, single-state scope.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {websites.map((w) => (
          <Card key={w.code}>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base">
                {w.name} <span className="font-normal text-muted-foreground">({w.code})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <GstSettingsForm website={w} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
