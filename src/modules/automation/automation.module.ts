import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaJobRunLogRepository } from './infrastructure/prisma-job-run-log.repository.js';
import { ListRegisteredJobs } from './application/list-registered-jobs.usecase.js';
import { ListJobRuns } from './application/list-job-runs.usecase.js';
import { listJobRunsQuerySchema } from './interface/http/schemas.js';

export interface AutomationRouters {
  admin: Router;
}

/** Worker-side composition root — src/workers/*.worker.ts import this
 *  directly (not the route-building createAutomationModule below) to get
 *  a JobRunLogRepository for recordJobRun(), same
 *  createAiRefreshDeps(db)-shape precedent as the ai module. */
export function createJobRunLogRepository(db: Db): PrismaJobRunLogRepository {
  return new PrismaJobRunLogRepository(db);
}

export function createAutomationModule(db: Db, authorize: (permission: string) => RequestHandler): AutomationRouters {
  const jobRunLogs = new PrismaJobRunLogRepository(db);
  const listRegisteredJobs = new ListRegisteredJobs(jobRunLogs);
  const listJobRuns = new ListJobRuns(jobRunLogs);

  const admin = Router();

  admin.get(
    '/automation/jobs',
    authorize('automation:view'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await listRegisteredJobs.execute() });
    }),
  );
  admin.get(
    '/automation/jobs/:jobName/runs',
    authorize('automation:view'),
    asyncHandler(async (req, res) => {
      const query = parse(listJobRunsQuerySchema, req.query);
      res.json({ data: await listJobRuns.execute(req.params.jobName!, query.limit) });
    }),
  );

  return { admin };
}
