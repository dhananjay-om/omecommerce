import { getConnection, listRuns } from './actions';
import { CatalogMigrationClient } from './catalog-migration-client';

export default async function CatalogMigrationPage() {
  const connection = await getConnection();
  const runs = connection ? await listRuns() : [];
  const latestRun = runs[0] ?? null;

  return (
    <div className="mt-6 max-w-3xl">
      <CatalogMigrationClient initialConnection={connection} initialRun={latestRun} />
    </div>
  );
}
