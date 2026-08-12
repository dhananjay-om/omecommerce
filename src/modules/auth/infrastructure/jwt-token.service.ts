import jwt from 'jsonwebtoken';
import type { TokenService, AuthTokenPayload } from '../domain/ports.js';

const TOKEN_TTL = '1h';

export class JwtTokenService implements TokenService {
  constructor(private readonly secret: string) {}

  sign(payload: AuthTokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: TOKEN_TTL });
  }

  verify(token: string): AuthTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret);
      if (typeof decoded !== 'object' || decoded === null) return null;
      const { adminUserPublicId, permissions } = decoded as Record<string, unknown>;
      if (typeof adminUserPublicId !== 'string' || !Array.isArray(permissions)) return null;
      return { adminUserPublicId, permissions: permissions.filter((p): p is string => typeof p === 'string') };
    } catch {
      return null;
    }
  }
}
