import 'server-only';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { ShippingMethod, OrderView } from '@/types/order';

/** Server Component reads only — direct to Express. */
export function listShippingMethods(currency: string): Promise<ShippingMethod[]> {
  return apiGet<ShippingMethod[]>(`/store/v1/shipping-methods${buildQuery({ currency })}`);
}

export function getOrder(publicId: string): Promise<OrderView> {
  return apiGet<OrderView>(`/store/v1/orders/${publicId}`);
}
