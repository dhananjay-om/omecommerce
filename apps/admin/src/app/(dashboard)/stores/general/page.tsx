import { apiGet } from '@/lib/api-client';
import type { Website } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GeneralSettingsForm } from './general-settings-form';

export default async function GeneralSettingsPage() {
  const websites = await apiGet<Website[]>('/admin/v1/websites');

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">General Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Store branding — logo, mailing address, and contact email. Shown on the invoice letterhead and elsewhere in
          the storefront; none of this affects tax calculation (see GST Settings for that).
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
              <GeneralSettingsForm website={w} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
