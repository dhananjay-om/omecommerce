import type { MigrationRunInfo, MigrationChannel } from '../domain/repositories.js';
import type { MigrationRunView, MigrationPlan, MigrationRunResult } from './dto.js';

/** Shared by every use case that returns a run (Analyze/Start/Get/List) so
 *  the shape is defined exactly once. `channel` isn't stored on the run row
 *  itself (only `connectionId` is) — every caller already has it on hand
 *  from resolving the connection, so it's passed in rather than re-queried. */
export function toMigrationRunView(run: MigrationRunInfo, channel: MigrationChannel): MigrationRunView {
  return {
    publicId: run.publicId,
    channel,
    dataType: run.dataType,
    status: run.status,
    totalItems: run.totalItems,
    processedItems: run.processedItems,
    skippedItems: run.skippedItems,
    failedItems: run.failedItems,
    plan: (run.planJson as MigrationPlan | null) ?? null,
    result: (run.resultJson as MigrationRunResult | null) ?? null,
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    createdAt: run.createdAt.toISOString(),
  };
}
