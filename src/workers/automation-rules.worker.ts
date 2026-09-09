import type { Job } from 'bullmq';
import { createAutomationRuleEvaluationDeps } from '../modules/automation/automation.module.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';

/** Every real outbox eventType the Rules/Workflows engine can trigger on
 *  — see EvaluateAutomationRules' own EVENT_TO_TRIGGER map (the single
 *  source of truth for this list; kept here too only because a Set
 *  lookup is cheaper than constructing the usecase just to check). */
const AUTOMATION_EVENTS = new Set(['OrderPlaced', 'OrderPaid', 'OrderCancelled', 'OrderRefunded', 'Shipped', 'OrderClosed', 'StockChanged', 'CustomerRegistered']);

/** Per-job-name handler for the shared `domain-events` Worker (workers/
 *  index.ts's startDomainEventsWorker() — same "one Worker per queue
 *  name" reasoning as every other domain-event consumer). Its own
 *  failure is caught and logged by that shared dispatch loop, same as
 *  every other handler there — no extra try/catch needed here. */
export function createAutomationRulesHandler(): (job: Job) => Promise<void> {
  const { evaluateAutomationRules } = createAutomationRuleEvaluationDeps(prisma);
  return async (job: Job) => {
    if (!AUTOMATION_EVENTS.has(job.name)) return;
    const { aggregateId, payload } = job.data as { aggregateId: string; payload: Record<string, unknown> | null };
    await evaluateAutomationRules.execute(job.name, aggregateId, payload ?? {});
  };
}
