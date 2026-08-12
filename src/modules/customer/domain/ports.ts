/**
 * Deliberately NOT reusing auth's AuthTokenPayload/TokenService — a customer
 * token's shape ({customerPublicId}) can never accidentally satisfy an admin
 * authorize() check (which strictly requires adminUserPublicId + permissions[]),
 * and vice versa. See customer.module.ts's header comment.
 */
export interface CustomerTokenPayload {
  customerPublicId: string;
}

export interface CustomerTokenService {
  sign(payload: CustomerTokenPayload): string;
  /** Returns null on any verification failure (expired, malformed, wrong signature). */
  verify(token: string): CustomerTokenPayload | null;
}
