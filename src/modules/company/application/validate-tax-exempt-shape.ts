import { ValidationError } from '../../../shared/domain/errors.js';

/**
 * Mirrors the DB's own `company_tax_exempt_ref_required` CHECK
 * (prisma/sql/0013_company_raw.sql) — surfaced here as a friendly 422
 * instead of a raw constraint violation, same discipline as referral's
 * validateRewardShape() for its own DB-backed shape CHECKs.
 */
export function validateTaxExemptShape(taxExempt: boolean, taxExemptionRef: string | null | undefined): void {
  if (taxExempt && !taxExemptionRef) {
    throw new ValidationError('taxExemptionRef is required when taxExempt is true', [
      { path: 'taxExemptionRef', message: 'required when taxExempt is true' },
    ]);
  }
}
