import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { AutomationRuleRunRepository, AutomationRuleRunView, RecordAutomationRuleRunInput, ActionType } from '../domain/repositories.js';

export class PrismaAutomationRuleRunRepository implements AutomationRuleRunRepository {
  constructor(private readonly db: Db) {}

  async record(input: RecordAutomationRuleRunInput): Promise<void> {
    await this.db.automationRuleRun.create({
      data: {
        ruleId: input.ruleId,
        matched: input.matched,
        entityType: input.entityType,
        entityPublicId: input.entityPublicId,
        actionResults: input.actionResults as object,
      },
    });
  }

  async listByRule(ruleId: bigint, limit: number): Promise<AutomationRuleRunView[]> {
    const rows = await this.db.automationRuleRun.findMany({
      where: { ruleId },
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      ruleId: row.ruleId,
      triggeredAt: row.triggeredAt,
      matched: row.matched,
      entityType: row.entityType,
      entityPublicId: row.entityPublicId,
      actionResults: (row.actionResults ?? []) as Array<{ type: ActionType; ok: boolean; error?: string }>,
    }));
  }
}
