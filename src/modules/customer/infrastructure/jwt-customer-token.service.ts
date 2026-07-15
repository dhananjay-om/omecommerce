import jwt from 'jsonwebtoken';
import type { CustomerTokenService, CustomerTokenPayload } from '../domain/ports.js';

const TOKEN_TTL = '1h';

/**
 * Signed with the same env.JWT_SECRET as admin tokens (no new required env var)
 * — the payload SHAPE is the actual boundary preventing cross-use: verify()
 * here rejects anything without a string customerPublicId, so an admin token
 * (adminUserPublicId + permissions[], no customerPublicId) already fails this
 * check, and vice versa auth's verify() rejects a customer token.
 */
export class JwtCustomerTokenService implements CustomerTokenService {
  constructor(private readonly secret: string) {}

  sign(payload: CustomerTokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: TOKEN_TTL });
  }

  verify(token: string): CustomerTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret);
      if (typeof decoded !== 'object' || decoded === null) return null;
      const { customerPublicId } = decoded as Record<string, unknown>;
      if (typeof customerPublicId !== 'string') return null;
      return { customerPublicId };
    } catch {
      return null;
    }
  }
}
