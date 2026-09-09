export type JobRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface JobRunLogView {
  id: bigint;
  jobName: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: JobRunStatus;
  errorMessage: string | null;
}

/** Backs the Scheduled Jobs admin page. BullMQ itself retains zero job
 *  history (both queues are configured removeOnComplete/removeOnFail —
 *  see queues.ts), so this is a real, separate record of what actually
 *  happened, written by each job handler itself via recordJobRun()
 *  (infrastructure/job-run-recorder.ts), not inferred from BullMQ. */
export interface JobRunLogRepository {
  recordStart(jobName: string): Promise<bigint>;
  recordFinish(id: bigint, status: 'SUCCEEDED' | 'FAILED', errorMessage?: string | null): Promise<void>;
  listRecent(jobName: string, limit: number): Promise<JobRunLogView[]>;
  lastRun(jobName: string): Promise<JobRunLogView | null>;
}
