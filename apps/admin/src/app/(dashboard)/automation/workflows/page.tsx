import { apiGet } from '@/lib/api-client';
import type { AutomationRule } from '@/lib/types';
import { RulesTable } from '../rules-table';
import { RuleFormDialog } from '../rule-form-dialog';

const MAX_CONDITIONS = 10;
const MAX_ACTIONS = 10;

/** Workflows — the full multi-condition/multi-action builder over the
 *  same automation_rule table Rules lists (see the plan's own "one
 *  engine, two framings" decision). Form-based (dropdowns/forms, same UI
 *  conventions as every other admin page), not a drag-and-drop visual
 *  canvas — confirmed with the user. */
export default async function WorkflowsPage() {
  const rules = await apiGet<AutomationRule[]>('/admin/v1/automation/rules');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Workflows</h1>
          <p className="mt-1 text-sm text-muted-foreground">Automated WHEN/IF/THEN rules that run without manual intervention.</p>
        </div>
        <RuleFormDialog surfaceLabel="Workflow" maxConditions={MAX_CONDITIONS} maxActions={MAX_ACTIONS} />
      </div>

      <div className="mt-6">
        <RulesTable rules={rules} surfaceLabel="Workflow" maxConditions={MAX_CONDITIONS} maxActions={MAX_ACTIONS} />
      </div>
    </div>
  );
}
