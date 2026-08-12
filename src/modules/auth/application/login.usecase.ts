import type { AdminUserRepository } from '../domain/repositories.js';
import type { PasswordHasher, TokenService } from '../domain/ports.js';
import { DomainError } from '../../../shared/domain/errors.js';

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('invalid email or password', 'https://errors.ome/invalid-credentials', 401);
  }
}

export interface LoginCommand {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  adminUserPublicId: string;
  permissions: string[];
}

export class Login {
  constructor(
    private readonly adminUsers: AdminUserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(cmd: LoginCommand): Promise<LoginResult> {
    const user = await this.adminUsers.findByEmail(cmd.email);
    // Verify against a fixed dummy hash when the user doesn't exist, so the
    // response time doesn't leak whether the email is registered (a standard
    // timing-attack mitigation for login endpoints).
    const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
    const passwordOk = await this.hasher.verify(cmd.password, hashToCheck);

    if (!user || !user.isActive || !passwordOk) {
      throw new InvalidCredentialsError();
    }

    const permissions = await this.adminUsers.findPermissions(user.id);
    const token = this.tokens.sign({ adminUserPublicId: user.publicId, permissions });
    return { token, adminUserPublicId: user.publicId, permissions };
  }
}

// A syntactically valid scrypt "salt:hash" that will never match a real
// password — exists purely so the verify() call above always does equivalent
// work whether or not the account exists.
const DUMMY_HASH = '0'.repeat(32) + ':' + '0'.repeat(128);
