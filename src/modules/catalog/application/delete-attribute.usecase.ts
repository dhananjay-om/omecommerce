import type { AttributeRepository } from '../domain/repositories.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';

/** Soft-delete, guarded: rejects an attribute still assigned to any attribute set — remove it from
 *  those sets first (RemoveAttributeFromSet). Mirrors DeleteBrand/DeleteCategory's guarded pattern. */
export class DeleteAttribute {
  constructor(private readonly attributes: AttributeRepository) {}

  async execute(code: string): Promise<void> {
    const attribute = await this.attributes.findByCode(code);
    if (!attribute) throw new NotFoundError('attribute', code);

    if (await this.attributes.isAssignedToAnySet(attribute.id)) {
      throw new ConflictError(
        'cannot delete an attribute that is still assigned to one or more attribute sets — remove it from those sets first',
      );
    }
    await this.attributes.softDelete(attribute.id);
  }
}
