import type { AttributeSetRepository, AttributeRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';

function parseId(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError('invalid attribute set id', [{ path: 'id', message: 'expected numeric id' }]);
  }
  return BigInt(value);
}

/**
 * Un-assigns an attribute from a set (whichever group it's in) — a precondition for deleting the
 * attribute itself once it's no longer needed anywhere, and useful on its own to reorganize a set.
 * Never touches the Attribute row or any product's already-stored value for it.
 */
export class RemoveAttributeFromSet {
  constructor(
    private readonly attributeSets: AttributeSetRepository,
    private readonly attributes: AttributeRepository,
  ) {}

  async execute(attributeSetId: string, attributeCode: string): Promise<void> {
    const setId = parseId(attributeSetId);
    if (!(await this.attributeSets.findSetById(setId))) {
      throw new NotFoundError('attribute set', attributeSetId);
    }
    const attribute = await this.attributes.findByCode(attributeCode.trim());
    if (!attribute) throw new NotFoundError('attribute', attributeCode);
    if (!(await this.attributeSets.isAttributeAssigned(setId, attribute.id))) {
      throw new NotFoundError('attribute assignment', attributeCode);
    }
    await this.attributeSets.removeAttributeAssignment(setId, attribute.id);
  }
}
