import type { AutomationRuleRepository, AutomationRuleView, ConditionSpec, ActionSpec } from '../domain/repositories.js';
import type { AutomationRuleDto, CreateAutomationRuleCommand, UpdateAutomationRuleCommand } from './dto.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

function toDto(rule: AutomationRuleView): AutomationRuleDto {
  return {
    publicId: rule.publicId,
    name: rule.name,
    description: rule.description,
    triggerType: rule.triggerType,
    conditions: rule.conditions,
    actions: rule.actions,
    isActive: rule.isActive,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

/** `.default([])`/`.default({})` in the zod schemas don't always flow
 *  cleanly through this project's shared `parse<T>()` helper's inference
 *  (a known gap, worked around the same way elsewhere in this codebase:
 *  keep the command type optional, default it here instead). */
function withDefaults(conditions: CreateAutomationRuleCommand['conditions'], actions: CreateAutomationRuleCommand['actions']): { conditions: ConditionSpec[]; actions: ActionSpec[] } {
  return {
    conditions: conditions ?? [],
    actions: actions.map((a) => ({ type: a.type, config: a.config ?? {} })),
  };
}

export class CreateAutomationRule {
  constructor(private readonly rules: AutomationRuleRepository) {}

  async execute(cmd: CreateAutomationRuleCommand): Promise<AutomationRuleDto> {
    const { conditions, actions } = withDefaults(cmd.conditions, cmd.actions);
    const rule = await this.rules.create({
      name: cmd.name,
      description: cmd.description ?? null,
      triggerType: cmd.triggerType,
      conditions,
      actions,
      isActive: cmd.isActive,
    });
    return toDto(rule);
  }
}

export class UpdateAutomationRule {
  constructor(private readonly rules: AutomationRuleRepository) {}

  async execute(publicId: string, cmd: UpdateAutomationRuleCommand): Promise<AutomationRuleDto> {
    const rule = await this.rules.update(publicId, {
      name: cmd.name,
      description: cmd.description,
      conditions: cmd.conditions,
      actions: cmd.actions ? cmd.actions.map((a) => ({ type: a.type, config: a.config ?? {} })) : undefined,
      isActive: cmd.isActive,
    });
    return toDto(rule);
  }
}

export class DeleteAutomationRule {
  constructor(private readonly rules: AutomationRuleRepository) {}

  async execute(publicId: string): Promise<void> {
    const existing = await this.rules.findByPublicId(publicId);
    if (!existing) throw new NotFoundError('AutomationRule', publicId);
    await this.rules.delete(publicId);
  }
}

export class ListAutomationRules {
  constructor(private readonly rules: AutomationRuleRepository) {}

  async execute(): Promise<AutomationRuleDto[]> {
    const rows = await this.rules.list();
    return rows.map(toDto);
  }
}
