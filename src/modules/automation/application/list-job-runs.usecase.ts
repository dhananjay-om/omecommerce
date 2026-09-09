import type { JobRunLogRepository } from '../domain/repositories.js';
import type { JobRunDto } from './dto.js';
import { toJobRunDto } from './list-registered-jobs.usecase.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Recent run history for one job — thin, mirrors this session's other
 *  "list-X" usecases. */
export class ListJobRuns {
  constructor(private readonly logs: JobRunLogRepository) {}

  async execute(jobName: string, limit?: number): Promise<JobRunDto[]> {
    const cappedLimit = limit && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT;
    const runs = await this.logs.listRecent(jobName, cappedLimit);
    return runs.map(toJobRunDto);
  }
}
