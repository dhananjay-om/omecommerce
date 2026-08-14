import { z } from 'zod';

const requiredAddressSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  line1: z.string().min(1, 'Address is required.'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required.'),
  region: z.string().optional(),
  /** GST state — feeds the CGST/SGST-vs-IGST determination at checkout. */
  stateCode: z.string().optional(),
  gstin: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required.'),
  country: z.string().length(2, 'Use a 2-letter country code (e.g. US).'),
  phone: z.string().optional(),
});

/** Every field optional — billingAddress is only required when `sameAsShipping` is false, enforced below via superRefine so it doesn't block final submit while those (hidden) fields are still blank. */
const optionalAddressSchema = z.object({
  name: z.string().optional(),
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  stateCode: z.string().optional(),
  gstin: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
});

export const checkoutSchema = z
  .object({
    email: z.string().email('Enter a valid email address.'),
    shippingAddress: requiredAddressSchema,
    sameAsShipping: z.boolean(),
    billingAddress: optionalAddressSchema,
    shippingMethodCode: z.string().min(1, 'Select a shipping method.'),
    paymentMethod: z.string().min(1),
    testScenario: z.enum(['approve', 'decline']),
  })
  .superRefine((values, ctx) => {
    if (values.sameAsShipping) return;
    const required: Array<[keyof typeof values.billingAddress, string]> = [
      ['name', 'Name is required.'],
      ['line1', 'Address is required.'],
      ['city', 'City is required.'],
      ['postalCode', 'Postal code is required.'],
    ];
    for (const [field, message] of required) {
      if (!values.billingAddress[field]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['billingAddress', field] });
      }
    }
    if ((values.billingAddress.country ?? '').length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Use a 2-letter country code (e.g. US).',
        path: ['billingAddress', 'country'],
      });
    }
  });

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export const STEP_FIELDS: Record<number, (keyof CheckoutFormValues | `${'shippingAddress' | 'billingAddress'}.${string}`)[]> = {
  1: ['email', 'shippingAddress.name', 'shippingAddress.line1', 'shippingAddress.city', 'shippingAddress.postalCode', 'shippingAddress.country'],
  2: ['billingAddress.name', 'billingAddress.line1', 'billingAddress.city', 'billingAddress.postalCode', 'billingAddress.country'],
  3: ['shippingMethodCode'],
  4: ['paymentMethod'],
  5: [],
};
