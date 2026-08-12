import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHasher } from '../domain/ports.js';

const scrypt = promisify(scryptCb);
const KEY_LENGTH = 64;

/**
 * Password hashing via Node's built-in scrypt (a proper KDF) rather than adding
 * an external bcrypt dependency — scrypt is memory-hard and well-suited to this
 * purpose, and Node ships it natively. Stored as "salt:hash", both hex.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plaintext: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = (await scrypt(plaintext, salt, KEY_LENGTH)) as Buffer;
    return `${salt}:${derived.toString('hex')}`;
  }

  async verify(plaintext: string, stored: string): Promise<boolean> {
    const [salt, hashHex] = stored.split(':');
    if (!salt || !hashHex) return false;
    const derived = (await scrypt(plaintext, salt, KEY_LENGTH)) as Buffer;
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  }
}
