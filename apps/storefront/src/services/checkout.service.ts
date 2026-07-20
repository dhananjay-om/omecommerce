import { api } from '@/lib/axios';

export interface CheckoutAddress {
  name: string;
  company?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface CheckoutInput {
  email: string;
  billingAddress: CheckoutAddress;
  shippingAddress: CheckoutAddress;
  shippingMethodCode: string;
  paymentMethod: string;
}

/** Client Component mutations only — via the same-origin /api/checkout Route Handler. Full UI arrives in Phase 7. */
export async function completeCheckout(input: CheckoutInput): Promise<unknown> {
  const res = await api.post('/checkout', input);
  return res.data;
}
