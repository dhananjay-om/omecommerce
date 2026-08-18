type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline';

const POSITIVE = new Set(['ACTIVE', 'PAID', 'COMPLETED', 'FULFILLED', 'BOTH', 'CLOSED', 'SENT', 'ISSUED', 'DELIVERED', 'REDEEMED', 'REWARDED']);
const NEGATIVE = new Set(['DISABLED', 'CANCELLED', 'VOIDED', 'INACTIVE', 'NOT_VISIBLE', 'FAILED', 'FROZEN', 'EXPIRED', 'REVERSED']);
const NEUTRAL_WARNING = new Set([
  'DRAFT',
  'PENDING',
  'PROCESSING',
  'ON_HOLD',
  'AUTHORIZED',
  'UNFULFILLED',
  'PARTIALLY_FULFILLED',
  'PARTIALLY_REFUNDED',
  'CONFIRMED',
  'PARTIALLY_PAID',
  'PACKED',
  'SHIPPED',
  'SIGNED_UP',
  'QUALIFIED',
]);

/** Maps the many status-like enum strings across products/orders/customers to a consistent badge color. */
export function statusBadgeVariant(status: string): BadgeVariant {
  if (POSITIVE.has(status)) return 'success';
  if (NEGATIVE.has(status)) return 'destructive';
  if (NEUTRAL_WARNING.has(status)) return 'warning';
  return 'secondary';
}
