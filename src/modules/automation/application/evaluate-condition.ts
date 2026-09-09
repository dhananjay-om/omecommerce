import type { ConditionSpec } from '../domain/repositories.js';

/** Plain field/comparator/value checks against a resolved entity's own
 *  real fields — same "resolve real data, never fabricate" discipline as
 *  every other rule engine in this codebase (Alerts, AI Insights). All
 *  conditions on a rule are ANDed; zero conditions always matches (useful
 *  for "on every X, do Y" with no filter). An unknown field name (a rule
 *  authored for one trigger type, then the entity doesn't carry that
 *  field) safely evaluates false rather than throwing — a misconfigured
 *  rule just never matches, it doesn't crash the dispatcher for every
 *  other rule sharing this event. */
export function evaluateConditions(conditions: ConditionSpec[], fields: Record<string, string | number | null>): boolean {
  return conditions.every((c) => evaluateOne(c, fields[c.field] ?? null));
}

function evaluateOne(condition: ConditionSpec, fieldValue: string | number | null): boolean {
  if (fieldValue === null) return false;

  if (typeof fieldValue === 'number') {
    const target = Number(condition.value);
    if (Number.isNaN(target)) return false;
    switch (condition.comparator) {
      case 'eq':
        return fieldValue === target;
      case 'neq':
        return fieldValue !== target;
      case 'gt':
        return fieldValue > target;
      case 'gte':
        return fieldValue >= target;
      case 'lt':
        return fieldValue < target;
      case 'lte':
        return fieldValue <= target;
      default:
        return false;
    }
  }

  switch (condition.comparator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'contains':
      return fieldValue.toLowerCase().includes(condition.value.toLowerCase());
    default:
      return false;
  }
}
