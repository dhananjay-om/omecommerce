import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  AutomationRuleRepository,
  AutomationRuleView,
  AutomationTriggerType,
  ConditionSpec,
  ActionSpec,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

export class PrismaAutomationRuleRepository implements AutomationRuleRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateAutomationRuleInput): Promise<AutomationRuleView> {
    const row = await this.db.automationRule.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        triggerType: input.triggerType,
        conditions: input.conditions as object,
        actions: input.actions as object,
        isActive: input.isActive ?? true,
      },
    });
    return toView(row);
  }

  async update(publicId: string, input: UpdateAutomationRuleInput): Promise<AutomationRuleView> {
    const existing = await this.db.automationRule.findUnique({ where: { publicId } });
    if (!existing) throw new NotFoundError('AutomationRule', publicId);
    const row = await this.db.automationRule.update({
      where: { publicId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.conditions !== undefined ? { conditions: input.conditions as object } : {}),
        ...(input.actions !== undefined ? { actions: input.actions as object } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return toView(row);
  }

  async delete(publicId: string): Promise<void> {
    await this.db.automationRule.delete({ where: { publicId } });
  }

  async findByPublicId(publicId: string): Promise<AutomationRuleView | null> {
    const row = await this.db.automationRule.findUnique({ where: { publicId } });
    return row ? toView(row) : null;
  }

  async list(): Promise<AutomationRuleView[]> {
    const rows = await this.db.automationRule.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toView);
  }

  async listActiveByTrigger(triggerType: AutomationTriggerType): Promise<AutomationRuleView[]> {
    const rows = await this.db.automationRule.findMany({ where: { triggerType, isActive: true } });
    return rows.map(toView);
  }
}

function toView(row: {
  id: bigint;
  publicId: string;
  name: string;
  description: string | null;
  triggerType: string;
  conditions: unknown;
  actions: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AutomationRuleView {
  return {
    id: row.id,
    publicId: row.publicId,
    name: row.name,
    description: row.description,
    triggerType: row.triggerType as AutomationTriggerType,
    conditions: (row.conditions ?? []) as ConditionSpec[],
    actions: (row.actions ?? []) as ActionSpec[],
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
