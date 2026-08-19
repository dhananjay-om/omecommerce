import type { CreditTermsType } from '@prisma/client';

const TERMS_DAYS: Record<CreditTermsType, number> = {
  NET_15: 15,
  NET_30: 30,
  NET_45: 45,
  NET_60: 60,
};

/** Pure calculator, no I/O — same shape as order/domain/gst.ts's splitGst(). Computed from the account's CURRENT termsType at charge time and snapshotted onto the CompanyCreditTransaction row (see company.prisma's header comment on why). */
export function computeDueAt(chargedAt: Date, termsType: CreditTermsType): Date {
  const dueAt = new Date(chargedAt);
  dueAt.setUTCDate(dueAt.getUTCDate() + TERMS_DAYS[termsType]);
  return dueAt;
}
