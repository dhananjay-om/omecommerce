import type { AttributeSetRepository } from '../domain/repositories.js';
import { NotFoundError, ConflictError, ValidationError } from '../../../shared/domain/errors.js';

function parseId(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError('invalid attribute set id', [{ path: 'id', message: 'expected numeric id' }]);
  }
  return BigInt(value);
}

/** Soft-delete, guarded: rejects a set still used by any product — every product requires exactly
 *  one attribute set (a required FK), so reassign them to a different set first, then delete. */
export class DeleteAttributeSet {
  constructor(private readonly attributeSets: AttributeSetRepository) {}

  async execute(id: string): Promise<void> {
    const setId = parseId(id);
    const set = await this.attributeSets.findSetById(setId);
    if (!set) throw new NotFoundError('attribute set', id);

    if (await this.attributeSets.hasProducts(setId)) {
      throw new ConflictError(
        'cannot delete an attribute set that is still used by one or more products — reassign them to a different set first',
      );
    }
    await this.attributeSets.softDelete(setId);
  }
}
