import { z } from 'zod';
import { CompanyStatus, CompanyMemberRole, CreditTermsType, WalletStatus } from '@prisma/client';

/** Normalizes a whitespace-only or blank string to undefined before the real
 *  schema sees it — own-copy per module, same convention as store/order/catalog. */
function blankToUndefined(schema: z.ZodTypeAny) {
  return z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), schema);
}

const gstinSchema = blankToUndefined(
  z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'expected a valid 15-character GSTIN')
    .nullish(),
);

export const createCompanySchema = z.object({
  websiteCode: z.string().min(1),
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(255),
  customerGroupCode: blankToUndefined(z.string().min(1).nullish()),
  taxExempt: z.boolean().optional(),
  taxExemptionRef: blankToUndefined(z.string().max(255).nullish()),
  gstin: gstinSchema,
  billingContactName: blankToUndefined(z.string().max(255).nullish()),
  billingContactEmail: blankToUndefined(z.string().email().max(255).nullish()),
  billingContactPhone: blankToUndefined(z.string().max(32).nullish()),
});

export const updateCompanySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  customerGroupCode: blankToUndefined(z.string().min(1).nullish()),
  taxExempt: z.boolean().optional(),
  taxExemptionRef: blankToUndefined(z.string().max(255).nullish()),
  gstin: gstinSchema,
  billingContactName: blankToUndefined(z.string().max(255).nullish()),
  billingContactEmail: blankToUndefined(z.string().email().max(255).nullish()),
  billingContactPhone: blankToUndefined(z.string().max(32).nullish()),
});

export const setCompanyStatusSchema = z.object({
  status: z.nativeEnum(CompanyStatus),
});

export const listCompaniesQuerySchema = z.object({
  websiteCode: z.string().optional(),
  status: z.nativeEnum(CompanyStatus).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const addCompanyMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(CompanyMemberRole).optional(),
});

export const updateCompanyMemberRoleSchema = z.object({
  role: z.nativeEnum(CompanyMemberRole),
});

// --- Credit terms (plan/15 Phase 7) ---

export const setCompanyCreditTermsSchema = z.object({
  creditLimit: z.string().min(1).optional(),
  termsType: z.nativeEnum(CreditTermsType).optional(),
});

export const recordCompanyCreditPaymentSchema = z.object({
  amount: z.string().min(1),
  reason: blankToUndefined(z.string().max(1000).nullish()),
  orderPublicIds: z.array(z.string().uuid()).min(1),
});

export const adjustCompanyCreditSchema = z.object({
  amount: z.string().min(1),
  reason: z.string().min(1).max(1000),
});

export const setCompanyCreditAccountStatusSchema = z.object({
  status: z.nativeEnum(WalletStatus),
});
