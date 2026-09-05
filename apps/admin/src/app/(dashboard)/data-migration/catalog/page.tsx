import { getConnection, listRuns } from './actions';
import { CatalogMigrationClient } from './catalog-migration-client';
import { ChannelTabs } from '../channel-tabs';
import type { MigrationChannel } from '@/lib/types';

export default async function CatalogMigrationPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const params = await searchParams;
  const channel: MigrationChannel = params.channel === 'MAGENTO' ? 'MAGENTO' : 'SHOPIFY';
  const connection = await getConnection(channel);
  const runs = connection ? await listRuns(channel) : [];
  const latestRun = runs[0] ?? null;

  return (
    <div className="mt-6 max-w-3xl space-y-6">
      <ChannelTabs basePath="/data-migration/catalog" channel={channel} />
      <CatalogMigrationClient channel={channel} initialConnection={connection} initialRun={latestRun} />
    </div>
  );
}
