import { getConnection, listRuns } from './actions';
import { OrderMigrationClient } from './order-migration-client';

export default async function OrderMigrationPage() {
  const connection = await getConnection();
  const runs = connection ? await listRuns() : [];
  const latestRun = runs[0] ?? null;

  return (
    <div className="mt-6 max-w-3xl">
      <OrderMigrationClient initialConnection={connection} initialRun={latestRun} />
    </div>
  );
}
