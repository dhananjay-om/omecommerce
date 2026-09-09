import { apiGet, buildQuery } from '@/lib/api-client';
import type { RegisteredJob, JobRun } from '@/lib/types';
import { DotBadge } from '@/components/dot-badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { relativeDate } from '@/lib/relative-date';

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function RunRow({ run }: { run: JobRun }) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-2 text-sm first:border-t-0">
      <div className="flex items-center gap-2">
        <DotBadge variant={statusBadgeVariant(run.status)}>{run.status}</DotBadge>
        <span className="text-muted-foreground">{relativeDate(run.startedAt)}</span>
      </div>
      <span className="text-xs text-muted-foreground">{formatDuration(run.durationMs)}</span>
      {run.errorMessage ? <span className="max-w-[50%] truncate text-xs text-destructive" title={run.errorMessage}>{run.errorMessage}</span> : null}
    </div>
  );
}

/** Real visibility into this store's existing background jobs — a real
 *  run-history table (job_run_log) each job's own handler writes to
 *  directly, not a read of BullMQ's own job data (which retains none;
 *  both queues clear completed/failed jobs immediately). These 4 jobs
 *  are the entire real set that exists today — this page doesn't let an
 *  admin create a new one (that's what Rules/Workflows are for; a fixed
 *  system job isn't user-authorable). */
export default async function ScheduledJobsPage() {
  const jobs = await apiGet<RegisteredJob[]>('/admin/v1/automation/jobs');
  const recentRuns = await Promise.all(
    jobs.map((j) => apiGet<JobRun[]>(`/admin/v1/automation/jobs/${encodeURIComponent(j.jobName)}/runs${buildQuery({ limit: 5 })}`)),
  );

  return (
    <div>
      <div>
        <h1 className="text-[1.32rem] font-extrabold tracking-tight">Scheduled Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">The recurring background jobs this store runs, and their real run history.</p>
      </div>

      <div className="mt-6 space-y-4">
        {jobs.map((job, i) => (
          <div key={job.jobName} className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{job.jobName}</h2>
                  {job.lastRun ? <DotBadge variant={statusBadgeVariant(job.lastRun.status)}>{job.lastRun.status}</DotBadge> : <DotBadge variant="secondary">Never run</DotBadge>}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{job.description}</p>
              </div>
              <div className="text-right text-sm">
                <div className="font-medium">{job.schedule}</div>
                {job.lastRun ? <div className="text-xs text-muted-foreground">last ran {relativeDate(job.lastRun.startedAt)}</div> : null}
              </div>
            </div>

            {recentRuns[i]!.length > 0 ? (
              <div className="border-t bg-muted/30">
                <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase">Recent runs</div>
                {recentRuns[i]!.map((run) => (
                  <RunRow key={run.id} run={run} />
                ))}
              </div>
            ) : (
              <p className="border-t px-4 py-3 text-sm text-muted-foreground">No runs recorded yet.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
