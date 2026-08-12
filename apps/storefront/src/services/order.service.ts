import 'server-only';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { ShippingMethod, OrderView, OrderTracking } from '@/types/order';

/** Server Component reads only — direct to Express. */
export function listShippingMethods(currency: string): Promise<ShippingMethod[]> {
  return apiGet<ShippingMethod[]>(`/store/v1/shipping-methods${buildQuery({ currency })}`);
}

export function getOrder(publicId: string): Promise<OrderView> {
  return apiGet<OrderView>(`/store/v1/orders/${publicId}`);
}

/** plan/15 Phase 12/13 — ownership-checked (unlike getOrder above), requires the customer's session. */
export function getCustomerOrder(publicId: string): Promise<OrderView> {
  return apiGet<OrderView>(`/store/v1/me/orders/${publicId}`, { auth: true });
}

export function getCustomerOrderTracking(publicId: string): Promise<OrderTracking> {
  return apiGet<OrderTracking>(`/store/v1/me/orders/${publicId}/tracking`, { auth: true });
}
