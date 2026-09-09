import type { JobRunLogRepository } from '../domain/repositories.js';
import type { JobRunDto, RegisteredJobDto } from './dto.js';

/** The 4 real scheduled jobs this app runs today — deliberately hardcoded
 *  string literals here (not imported from each worker file) to avoid a
 *  module-graph cycle (this usecase lives under src/modules/, worker files
 *  under src/workers/ already import FROM src/modules/automation/ to
 *  record their own runs — importing back the other way would create a
 *  real import cycle, not just a conceptual one). Must be kept in sync by
 *  hand with each worker file's own exported JOB_NAME constant — same
 *  "fixed vocabulary in app code" precedent as ruleCode/metricCode
 *  elsewhere in this codebase, just duplicated across 2 files instead of
 *  imported once, for that reason. */
const REGISTRY: Array<{ jobName: string; description: string; schedule: string }> = [
  { jobName: 'sweep-expired-reservations', description: 'Releases stock reservations that expired without checkout completing.', schedule: 'Every minute' },
  { jobName: 'sweep-expired-stored-value-holds', description: 'Releases wallet/gift-card holds placed at checkout that expired without completing.', schedule: 'Every minute' },
  { jobName: 'analytics-nightly-refresh', description: 'Recomputes yesterday’s summary tables, inventory snapshot, and RFM segments, then evaluates alert rules.', schedule: 'Daily at 02:15 UTC' },
  { jobName: 'ai-insights-nightly-refresh', description: 'Regenerates AI Insights, Product Forecasts, and Merchandising Suggestions for the day that just closed.', schedule: 'Daily at 02:30 UTC' },
];

export class ListRegisteredJobs {
  constructor(private readonly logs: JobRunLogRepository) {}

  async execute(): Promise<RegisteredJobDto[]> {
    return Promise.all(
      REGISTRY.map(async (job) => {
        const lastRun = await this.logs.lastRun(job.jobName);
        return { ...job, lastRun: lastRun ? toJobRunDto(lastRun) : null };
      }),
    );
  }
}

export function toJobRunDto(run: { id: bigint; startedAt: Date; finishedAt: Date | null; status: string; errorMessage: string | null }): JobRunDto {
  return {
    id: run.id.toString(),
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    status: run.status,
    errorMessage: run.errorMessage,
    durationMs: run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null,
  };
}
