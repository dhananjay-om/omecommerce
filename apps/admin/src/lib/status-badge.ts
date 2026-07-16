type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline';

const POSITIVE = new Set(['ACTIVE', 'PAID', 'COMPLETED', 'FULFILLED']);
const NEGATIVE = new Set(['DISABLED', 'CANCELLED', 'VOIDED', 'INACTIVE']);
const NEUTRAL_WARNING = new Set([
  'DRAFT',
  'PENDING',
  'PROCESSING',
  'ON_HOLD',
  'AUTHORIZED',
  'UNFULFILLED',
  'PARTIALLY_FULFILLED',
  'PARTIALLY_REFUNDED',
]);

/** Maps the many status-like enum strings across products/orders/customers to a consistent badge color. */
export function statusBadgeVariant(status: string): BadgeVariant {
  if (POSITIVE.has(status)) return 'success';
  if (NEGATIVE.has(status)) return 'destructive';
  if (NEUTRAL_WARNING.has(status)) return 'warning';
  return 'secondary';
}
