import type { AttributeSetRepository } from '../domain/repositories.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { CreateAttributeSetGroupCommand, AttributeSetGroupView } from './dto.js';

function parseId(value: string, field: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`invalid ${field}`, [{ path: field, message: 'expected numeric id' }]);
  }
  return BigInt(value);
}

export class CreateAttributeSetGroup {
  constructor(private readonly attributeSets: AttributeSetRepository) {}

  async execute(cmd: CreateAttributeSetGroupCommand): Promise<AttributeSetGroupView> {
    const attributeSetId = parseId(cmd.attributeSetId, 'attributeSetId');
    if (!(await this.attributeSets.findSetById(attributeSetId))) {
      throw new NotFoundError('attribute set', cmd.attributeSetId);
    }
    const name = cmd.name.trim();
    if (await this.attributeSets.findGroupByName(attributeSetId, name)) {
      throw new ConflictError(`group already exists in this attribute set: ${name}`);
    }
    const group = await this.attributeSets.createGroup(attributeSetId, name, cmd.sortOrder ?? 0);
    return {
      id: group.id.toString(),
      attributeSetId: group.attributeSetId.toString(),
      name: group.name,
      sortOrder: group.sortOrder,
    };
  }
}
