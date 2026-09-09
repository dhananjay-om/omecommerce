import type { AutomationTriggerType, AutomationActionType } from '@/lib/types';

export const TRIGGER_TYPES: Array<{ value: AutomationTriggerType; label: string }> = [
  { value: 'ORDER_PLACED', label: 'Order placed' },
  { value: 'ORDER_PAID', label: 'Order paid' },
  { value: 'ORDER_CANCELLED', label: 'Order cancelled' },
  { value: 'ORDER_REFUNDED', label: 'Order refunded' },
  { value: 'ORDER_SHIPPED', label: 'Order shipped' },
  { value: 'ORDER_CLOSED', label: 'Order closed' },
  { value: 'STOCK_CHANGED', label: 'Stock changed' },
  { value: 'CUSTOMER_REGISTERED', label: 'Customer registered' },
];

export type FieldKind = 'string' | 'number';

export interface FieldDef {
  field: string;
  label: string;
  kind: FieldKind;
}

/** The real fields each trigger's resolved entity actually carries — see
 *  EvaluateAutomationRules' own resolveEntity() (the single source of
 *  truth this mirrors). Every trigger here is order-scoped except
 *  STOCK_CHANGED/CUSTOMER_REGISTERED. */
const ORDER_FIELDS: FieldDef[] = [
  { field: 'status', label: 'Order status', kind: 'string' },
  { field: 'financialStatus', label: 'Payment status', kind: 'string' },
  { field: 'fulfillmentStatus', label: 'Fulfillment status', kind: 'string' },
  { field: 'grandTotal', label: 'Order total', kind: 'number' },
  { field: 'currency', label: 'Currency', kind: 'string' },
];

const STOCK_FIELDS: FieldDef[] = [
  { field: 'onHand', label: 'On-hand quantity (after this change)', kind: 'number' },
  { field: 'delta', label: 'Quantity change', kind: 'number' },
  { field: 'warehouseCode', label: 'Warehouse code', kind: 'string' },
];

const CUSTOMER_FIELDS: FieldDef[] = [{ field: 'email', label: 'Email', kind: 'string' }];

export function fieldsForTrigger(triggerType: AutomationTriggerType): FieldDef[] {
  if (triggerType === 'STOCK_CHANGED') return STOCK_FIELDS;
  if (triggerType === 'CUSTOMER_REGISTERED') return CUSTOMER_FIELDS;
  return ORDER_FIELDS;
}

export function isOrderTrigger(triggerType: AutomationTriggerType): boolean {
  return triggerType !== 'STOCK_CHANGED' && triggerType !== 'CUSTOMER_REGISTERED';
}

export const COMPARATORS_FOR_KIND: Record<FieldKind, Array<{ value: string; label: string }>> = {
  number: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '≥' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '≤' },
  ],
  string: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
    { value: 'contains', label: 'contains' },
  ],
};

export const ACTION_TYPES: Array<{ value: AutomationActionType; label: string; requiresOrder?: boolean }> = [
  { value: 'EMAIL', label: 'Send an email' },
  { value: 'WEBHOOK', label: 'Call a webhook' },
  { value: 'ORDER_NOTE', label: 'Add an internal order note', requiresOrder: true },
];
