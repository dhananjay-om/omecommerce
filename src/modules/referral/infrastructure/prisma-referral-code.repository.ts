import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { ReferralCodeRepository, ReferralCodeInfo } from '../domain/repositories.js';
import { generateReferralCode } from './code.js';

const CODE_SELECT = { id: true, publicId: true, programId: true, customerId: true, code: true, usesCount: true } as const;

const MAX_GENERATION_ATTEMPTS = 5;

/**
 * True only for a violation of the `code` unique index specifically (the
 * astronomically rare collision, safe to retry with a fresh code) — not
 * `uq_referral_code_program_customer` (a concurrent request already created
 * this customer's code, which a retry would never resolve). Checked against
 * the exact index name Prisma generates (`referral_code_code_key`), not a
 * substring match — a loose `.includes('code')` would also match
 * `uq_referral_code_program_customer` (it contains "code" as a substring
 * too) and wrongly retry a completely different constraint violation.
 * Postgres's connector can report `meta.target` as either the index name
 * (string) or a column-name array, so both shapes are checked.
 */
function isCodeIndexViolation(target: unknown): boolean {
  if (typeof target === 'string') return target === 'referral_code_code_key';
  if (Array.isArray(target)) return target.length === 1 && target[0] === 'code';
  return false;
}

export class PrismaReferralCodeRepository implements ReferralCodeRepository {
  constructor(private readonly db: Db) {}

  async findByCustomerAndProgram(customerId: bigint, programId: bigint): Promise<ReferralCodeInfo | null> {
    return this.db.referralCode.findFirst({ where: { customerId, programId }, select: CODE_SELECT });
  }

  async create(programId: bigint, customerId: bigint): Promise<ReferralCodeInfo> {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      try {
        return await this.db.referralCode.create({
          data: { programId, customerId, code: generateReferralCode() },
          select: CODE_SELECT,
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && isCodeIndexViolation(err.meta?.target)) {
          continue;
        }
        throw err;
      }
    }
    throw new Error(`failed to generate a unique referral code after ${MAX_GENERATION_ATTEMPTS} attempts`);
  }

  async findByCode(code: string): Promise<ReferralCodeInfo | null> {
    return this.db.referralCode.findFirst({ where: { code }, select: CODE_SELECT });
  }

  async incrementUses(id: bigint): Promise<void> {
    await this.db.referralCode.update({ where: { id }, data: { usesCount: { increment: 1 } } });
  }
}
