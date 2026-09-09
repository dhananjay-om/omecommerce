import { apiGet } from '@/lib/api-client';
import type { AutomationRule } from '@/lib/types';
import { RulesTable } from '../rules-table';
import { RuleFormDialog } from '../rule-form-dialog';

/** Rules — the fast, single-condition/single-action quick-create view
 *  over the same automation_rule table Workflows lists (see the plan's
 *  own "one engine, two framings" decision, not a separate system). */
export default async function RulesPage() {
  const rules = await apiGet<AutomationRule[]>('/admin/v1/automation/rules');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">Simple condition → action rules for cases that don&apos;t need a full workflow.</p>
        </div>
        <RuleFormDialog surfaceLabel="Rule" maxConditions={1} maxActions={1} />
      </div>

      <div className="mt-6">
        <RulesTable rules={rules} surfaceLabel="Rule" maxConditions={1} maxActions={1} />
      </div>
    </div>
  );
}
