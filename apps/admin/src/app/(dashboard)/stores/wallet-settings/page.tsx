import { apiGet } from '@/lib/api-client';
import type { Website } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WalletSettingsForm } from './wallet-settings-form';

export default async function WalletSettingsPage() {
  const websites = await apiGet<Website[]>('/admin/v1/websites');

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Wallet Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin-configurable rules for the &quot;Pay with wallet balance&quot; checkout tender on
          this website — a store-wide on/off switch, plus optional limits on how much of an order it
          may cover. Freezing an individual customer&apos;s wallet is separate — see that
          customer&apos;s Wallet tab.
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
              <WalletSettingsForm website={w} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
