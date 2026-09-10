import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaJobRunLogRepository } from './infrastructure/prisma-job-run-log.repository.js';
import { PrismaAutomationRuleRepository } from './infrastructure/prisma-automation-rule.repository.js';
import { PrismaAutomationRuleRunRepository } from './infrastructure/prisma-automation-rule-run.repository.js';
import { ListRegisteredJobs } from './application/list-registered-jobs.usecase.js';
import { ListJobRuns } from './application/list-job-runs.usecase.js';
import { CreateAutomationRule, UpdateAutomationRule, DeleteAutomationRule, ListAutomationRules } from './application/manage-automation-rule.usecases.js';
import { ListAutomationRuleRuns } from './application/list-automation-rule-runs.usecase.js';
import { EvaluateAutomationRules } from './application/evaluate-automation-rules.usecase.js';
import { TestWebhook } from './application/test-webhook.usecase.js';
import { listJobRunsQuerySchema, createAutomationRuleSchema, updateAutomationRuleSchema, listAutomationRuleRunsQuerySchema, testWebhookSchema } from './interface/http/schemas.js';
import { PrismaOrderRepository } from '../order/infrastructure/prisma-order.repository.js';
import { PrismaAdminUserLookup } from '../order/infrastructure/prisma-lookups.js';
import { AddOrderNote } from '../order/application/add-order-note.usecase.js';
import { createEmailSender } from '../order/order.module.js';
import { createNotifyAdminsDeps } from '../notification/notification.module.js';

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

/** Worker-side composition root for the Rules/Workflows dispatcher
 *  (src/workers/automation-rules.worker.ts, registered inside
 *  startDomainEventsWorker()'s existing handler list). Reuses
 *  createEmailSender (order.module.ts) so a rule's EMAIL action sends
 *  through the exact same adapter as every other email in this app. */
export function createAutomationRuleEvaluationDeps(db: Db): { evaluateAutomationRules: EvaluateAutomationRules } {
  const rules = new PrismaAutomationRuleRepository(db);
  const runs = new PrismaAutomationRuleRunRepository(db);
  const orders = new PrismaOrderRepository(db);
  const adminUsers = new PrismaAdminUserLookup(db);
  const addOrderNote = new AddOrderNote(orders, adminUsers);
  const emailSender = createEmailSender(db);
  const { notifyAdmins } = createNotifyAdminsDeps(db);
  const evaluateAutomationRules = new EvaluateAutomationRules(rules, runs, orders, { emailSender, addOrderNote, notifyAdmins });
  return { evaluateAutomationRules };
}

export function createAutomationModule(db: Db, authorize: (permission: string) => RequestHandler): AutomationRouters {
  const jobRunLogs = new PrismaJobRunLogRepository(db);
  const listRegisteredJobs = new ListRegisteredJobs(jobRunLogs);
  const listJobRuns = new ListJobRuns(jobRunLogs);

  const rules = new PrismaAutomationRuleRepository(db);
  const runs = new PrismaAutomationRuleRunRepository(db);
  const createRule = new CreateAutomationRule(rules);
  const updateRule = new UpdateAutomationRule(rules);
  const deleteRule = new DeleteAutomationRule(rules);
  const listRules = new ListAutomationRules(rules);
  const listRuns = new ListAutomationRuleRuns(rules, runs);
  const testWebhook = new TestWebhook();

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

  admin.get(
    '/automation/rules',
    authorize('automation:view'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await listRules.execute() });
    }),
  );
  admin.post(
    '/automation/rules',
    authorize('automation:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createAutomationRuleSchema, req.body);
      res.status(201).json({ data: await createRule.execute(body) });
    }),
  );
  admin.patch(
    '/automation/rules/:publicId',
    authorize('automation:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateAutomationRuleSchema, req.body);
      res.json({ data: await updateRule.execute(req.params.publicId!, body) });
    }),
  );
  admin.delete(
    '/automation/rules/:publicId',
    authorize('automation:manage'),
    asyncHandler(async (req, res) => {
      await deleteRule.execute(req.params.publicId!);
      res.status(204).send();
    }),
  );
  admin.get(
    '/automation/rules/:publicId/runs',
    authorize('automation:view'),
    asyncHandler(async (req, res) => {
      const query = parse(listAutomationRuleRunsQuerySchema, req.query);
      res.json({ data: await listRuns.execute(req.params.publicId!, query.limit) });
    }),
  );
  admin.post(
    '/automation/test-webhook',
    authorize('automation:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(testWebhookSchema, req.body);
      res.json({ data: await testWebhook.execute(body.url) });
    }),
  );

  return { admin };
}
