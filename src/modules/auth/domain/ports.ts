export interface PasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, hash: string): Promise<boolean>;
}

export interface AuthTokenPayload {
  adminUserPublicId: string;
  permissions: string[];
}

export interface TokenService {
  sign(payload: AuthTokenPayload): string;
  /** Returns null on any verification failure (expired, malformed, wrong signature). */
  verify(token: string): AuthTokenPayload | null;
}
