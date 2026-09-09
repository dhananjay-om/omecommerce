export interface JobRunDto {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  errorMessage: string | null;
  durationMs: number | null;
}

export interface RegisteredJobDto {
  jobName: string;
  description: string;
  schedule: string;
  lastRun: JobRunDto | null;
}
