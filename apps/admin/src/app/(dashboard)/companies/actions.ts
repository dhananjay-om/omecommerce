'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client';
import type {
  Company,
  CompanyCreditAccountView,
  CompanyMember,
  CompanyMemberRole,
  CompanyStatus,
  CreditTermsType,
} from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

function readCompanyFields(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const customerGroupCode = String(formData.get('customerGroupCode') ?? '').trim();
  const taxExempt = String(formData.get('taxExempt') ?? 'false') === 'true';
  const taxExemptionRef = String(formData.get('taxExemptionRef') ?? '').trim();
  const gstin = String(formData.get('gstin') ?? '').trim();
  const billingContactName = String(formData.get('billingContactName') ?? '').trim();
  const billingContactEmail = String(formData.get('billingContactEmail') ?? '').trim();
  const billingContactPhone = String(formData.get('billingContactPhone') ?? '').trim();
  return {
    name,
    customerGroupCode,
    taxExempt,
    taxExemptionRef,
    gstin,
    billingContactName,
    billingContactEmail,
    billingContactPhone,
  };
}

export async function createCompany(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const websiteCode = String(formData.get('websiteCode') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const {
    name,
    customerGroupCode,
    taxExempt,
    taxExemptionRef,
    gstin,
    billingContactName,
    billingContactEmail,
    billingContactPhone,
  } = readCompanyFields(formData);

  if (!websiteCode) return { error: 'Website is required.', success: false };
  if (!code) return { error: 'Code is required.', success: false };
  if (!name) return { error: 'Name is required.', success: false };
  // Mirrors the backend's own CHECK (422 without it) — see coupon-form.tsx's
  // documented precedent for this project's client-side CHECK-mirroring convention.
  if (taxExempt && !taxExemptionRef) {
    return {
      error: 'A tax exemption reference is required when tax exempt is checked.',
      success: false,
    };
  }

  let company: Company;
  try {
    company = await apiPost<Company>('/admin/v1/companies', {
      websiteCode,
      code,
      name,
      customerGroupCode: customerGroupCode || undefined,
      taxExempt,
      taxExemptionRef: taxExempt ? taxExemptionRef : undefined,
      gstin: gstin || undefined,
      billingContactName: billingContactName || undefined,
      billingContactEmail: billingContactEmail || undefined,
      billingContactPhone: billingContactPhone || undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  // Outside the try/catch on purpose — redirect() works by throwing a special
  // Next.js-internal signal, which the catch block above would otherwise
  // swallow and misreport as a form error.
  revalidatePath('/companies');
  redirect(`/companies/${company.publicId}`);
}

export async function updateCompany(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  const {
    name,
    customerGroupCode,
    taxExempt,
    taxExemptionRef,
    gstin,
    billingContactName,
    billingContactEmail,
    billingContactPhone,
  } = readCompanyFields(formData);

  if (!publicId) return { error: 'Missing company id.', success: false };
  if (!name) return { error: 'Name is required.', success: false };
  if (taxExempt && !taxExemptionRef) {
    return {
      error: 'A tax exemption reference is required when tax exempt is checked.',
      success: false,
    };
  }

  try {
    await apiPut<Company>(`/admin/v1/companies/${publicId}`, {
      name,
      customerGroupCode: customerGroupCode || null,
      taxExempt,
      taxExemptionRef: taxExempt ? taxExemptionRef : null,
      gstin: gstin || null,
      billingContactName: billingContactName || null,
      billingContactEmail: billingContactEmail || null,
      billingContactPhone: billingContactPhone || null,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/companies');
  revalidatePath(`/companies/${publicId}`);
  redirect(`/companies/${publicId}`);
}

export async function setCompanyStatus(
  publicId: string,
  status: CompanyStatus,
  _prevState: ActionState,
): Promise<ActionState> {
  try {
    await apiPost<Company>(`/admin/v1/companies/${publicId}/actions/set-status`, { status });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/companies');
  revalidatePath(`/companies/${publicId}`);
  return { error: null, success: true };
}

export async function addCompanyMember(
  publicId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const role = String(formData.get('role') ?? 'BUYER') as CompanyMemberRole;

  if (!email) return { error: 'Email is required.', success: false };

  try {
    await apiPost<CompanyMember>(`/admin/v1/companies/${publicId}/members`, { email, role });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/companies/${publicId}`);
  return { error: null, success: true };
}

export async function updateCompanyMemberRole(
  publicId: string,
  customerPublicId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const role = String(formData.get('role') ?? '').trim() as CompanyMemberRole;
  if (!role) return { error: 'Role is required.', success: false };

  try {
    await apiPut<CompanyMember>(`/admin/v1/companies/${publicId}/members/${customerPublicId}`, {
      role,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/companies/${publicId}`);
  return { error: null, success: true };
}

export async function removeCompanyMember(
  publicId: string,
  customerPublicId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  try {
    await apiDelete<void>(`/admin/v1/companies/${publicId}/members/${customerPublicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/companies/${publicId}`);
  return { error: null, success: true };
}

/** Creates the credit account on first call (currency defaults to the company's website's base
 *  currency server-side), or updates limit/terms on an existing one — both fields independent. */
export async function setCompanyCredit(
  publicId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const creditLimit = String(formData.get('creditLimit') ?? '').trim();
  const termsType = String(formData.get('termsType') ?? '').trim() as CreditTermsType | '';

  try {
    await apiPut<CompanyCreditAccountView>(`/admin/v1/companies/${publicId}/credit`, {
      creditLimit: creditLimit || undefined,
      termsType: termsType || undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/companies/${publicId}`);
  return { error: null, success: true };
}

/** Records a payment and settles every named order — an unknown/mismatched order publicId
 *  rejects the whole request, nothing is partially applied. */
export async function recordCompanyCreditPayment(
  publicId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const amount = String(formData.get('amount') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const orderPublicIds = formData.getAll('orderPublicIds').map(String);

  if (!amount) return { error: 'Amount is required.', success: false };
  if (orderPublicIds.length === 0)
    return { error: 'Select at least one open invoice to settle.', success: false };

  try {
    await apiPost<CompanyCreditAccountView>(
      `/admin/v1/companies/${publicId}/credit/actions/record-payment`,
      {
        amount,
        reason: reason || undefined,
        orderPublicIds,
      },
    );
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/companies/${publicId}`);
  return { error: null, success: true };
}

/** Signed manual correction — positive increases what's owed (rejected past the credit limit),
 *  negative decreases it (floored at 0). */
export async function adjustCompanyCredit(
  publicId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const amount = String(formData.get('amount') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!amount) return { error: 'Amount is required.', success: false };
  if (!reason) return { error: 'Reason is required.', success: false };

  try {
    await apiPost<CompanyCreditAccountView>(
      `/admin/v1/companies/${publicId}/credit/actions/adjust`,
      { amount, reason },
    );
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/companies/${publicId}`);
  return { error: null, success: true };
}

/** Freezing blocks further charges at checkout — payments/adjustments still work. */
export async function setCompanyCreditStatus(
  publicId: string,
  status: 'ACTIVE' | 'FROZEN',
  _prevState: ActionState,
): Promise<ActionState> {
  try {
    await apiPost<CompanyCreditAccountView>(
      `/admin/v1/companies/${publicId}/credit/actions/set-status`,
      { status },
    );
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/companies/${publicId}`);
  return { error: null, success: true };
}
