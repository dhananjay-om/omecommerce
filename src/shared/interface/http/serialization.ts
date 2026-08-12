/**
 * BigInt is not JSON-serializable by default. Prisma uses BigInt PKs; we expose
 * `publicId` (UUID) externally, but any stray BigInt must still serialize as a string.
 * Installed once at app bootstrap.
 */
export function installBigIntJson(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}
