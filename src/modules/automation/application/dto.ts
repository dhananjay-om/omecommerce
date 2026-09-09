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

import type { AutomationTriggerType, ConditionComparator, ActionType } from '../domain/repositories.js';

export interface ConditionSpecDto {
  field: string;
  comparator: ConditionComparator;
  value: string;
}

export interface ActionSpecDto {
  type: ActionType;
  /** Optional here (defaulted to {} inside the usecase) — same "blank
   *  means unchanged/defaulted in the usecase, not the zod schema"
   *  workaround this project uses wherever a zod `.default()` doesn't
   *  flow cleanly through the shared `parse<T>()` helper's inference. */
  config?: Record<string, string>;
}

export interface AutomationRuleDto {
  publicId: string;
  name: string;
  description: string | null;
  triggerType: string;
  conditions: ConditionSpecDto[];
  actions: ActionSpecDto[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationRuleCommand {
  name: string;
  description?: string | null;
  triggerType: AutomationTriggerType;
  /** Optional here, defaulted to [] inside the usecase — same parse<T>()
   *  workaround as ActionSpecDto.config above. */
  conditions?: ConditionSpecDto[];
  actions: ActionSpecDto[];
  isActive?: boolean;
}

export interface UpdateAutomationRuleCommand {
  name?: string;
  description?: string | null;
  conditions?: ConditionSpecDto[];
  actions?: ActionSpecDto[];
  isActive?: boolean;
}

export interface AutomationRuleRunDto {
  id: string;
  triggeredAt: string;
  matched: boolean;
  entityType: string | null;
  entityPublicId: string | null;
  actionResults: Array<{ type: string; ok: boolean; error?: string }>;
}
