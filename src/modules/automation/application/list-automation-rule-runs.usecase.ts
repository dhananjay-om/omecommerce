import type { AutomationRuleRepository, AutomationRuleRunRepository } from '../domain/repositories.js';
import type { AutomationRuleRunDto } from './dto.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Recent evaluation history for one rule — including non-matching
 *  evaluations, so "why didn't this fire" is answerable from real data. */
export class ListAutomationRuleRuns {
  constructor(
    private readonly rules: AutomationRuleRepository,
    private readonly runs: AutomationRuleRunRepository,
  ) {}

  async execute(rulePublicId: string, limit?: number): Promise<AutomationRuleRunDto[]> {
    const rule = await this.rules.findByPublicId(rulePublicId);
    if (!rule) throw new NotFoundError('AutomationRule', rulePublicId);
    const cappedLimit = limit && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT;
    const rows = await this.runs.listByRule(rule.id, cappedLimit);
    return rows.map((r) => ({
      id: r.id.toString(),
      triggeredAt: r.triggeredAt.toISOString(),
      matched: r.matched,
      entityType: r.entityType,
      entityPublicId: r.entityPublicId,
      actionResults: r.actionResults,
    }));
  }
}
