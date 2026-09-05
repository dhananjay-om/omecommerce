import { getConnection, listRuns } from './actions';
import { CustomerMigrationClient } from './customer-migration-client';

export default async function CustomerMigrationPage() {
  const connection = await getConnection();
  const runs = connection ? await listRuns() : [];
  const latestRun = runs[0] ?? null;

  return (
    <div className="mt-6 max-w-3xl">
      <CustomerMigrationClient initialConnection={connection} initialRun={latestRun} />
    </div>
  );
}
