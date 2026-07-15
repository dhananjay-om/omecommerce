import { DomainError } from '../../../shared/domain/errors.js';

/** Thrown for an unknown code, or a code whose program is not ACTIVE. */
export class ReferralCodeInvalidError extends DomainError {
  constructor(code: string) {
    super(`Referral code not found or program not active: ${code}`, 'https://errors.ome/referral-code-invalid', 404);
  }
}

/** Defense in depth — can't happen via the normal flow (a code's owner isn't the caller attaching it), but guarded anyway. */
export class SelfReferralError extends DomainError {
  constructor() {
    super('A customer cannot use their own referral code', 'https://errors.ome/self-referral', 422);
  }
}

export class MaxReferralsExceededError extends DomainError {
  constructor(max: number) {
    super(`Referrer has reached the maximum of ${max} referrals for this program`, 'https://errors.ome/max-referrals-exceeded', 409);
  }
}
