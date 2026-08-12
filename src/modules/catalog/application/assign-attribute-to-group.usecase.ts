import type { AttributeSetRepository, AttributeRepository } from '../domain/repositories.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { AssignAttributeToGroupCommand } from './dto.js';

function parseId(value: string, field: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`invalid ${field}`, [{ path: field, message: 'expected numeric id' }]);
  }
  return BigInt(value);
}

/**
 * Assigns a reusable Attribute into a specific AttributeSet's group + sort
 * position (plan/04 §2.1) — this is the junction the dynamic product editor
 * reads to render groups as tabs and attributes as typed inputs within them.
 */
export class AssignAttributeToGroup {
  constructor(
    private readonly attributeSets: AttributeSetRepository,
    private readonly attributes: AttributeRepository,
  ) {}

  async execute(cmd: AssignAttributeToGroupCommand): Promise<void> {
    const attributeSetId = parseId(cmd.attributeSetId, 'attributeSetId');
    const groupId = parseId(cmd.groupId, 'groupId');

    if (!(await this.attributeSets.findSetById(attributeSetId))) {
      throw new NotFoundError('attribute set', cmd.attributeSetId);
    }
    if (!(await this.attributeSets.findGroupById(attributeSetId, groupId))) {
      throw new NotFoundError('attribute set group', cmd.groupId);
    }
    const attribute = await this.attributes.findByCode(cmd.attributeCode.trim());
    if (!attribute) {
      throw new NotFoundError('attribute', cmd.attributeCode);
    }
    if (await this.attributeSets.isAttributeAssigned(attributeSetId, attribute.id)) {
      throw new ConflictError(`attribute already assigned to this set: ${cmd.attributeCode}`);
    }
    await this.attributeSets.assignAttribute(attributeSetId, groupId, attribute.id, cmd.sortOrder ?? 0);
  }
}
