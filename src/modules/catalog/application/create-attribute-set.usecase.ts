import type { AttributeSetRepository } from '../domain/repositories.js';
import { ConflictError } from '../../../shared/domain/errors.js';
import type { CreateAttributeSetCommand, AttributeSetView } from './dto.js';

export class CreateAttributeSet {
  constructor(private readonly attributeSets: AttributeSetRepository) {}

  async execute(cmd: CreateAttributeSetCommand): Promise<AttributeSetView> {
    const code = cmd.code.trim();
    if (await this.attributeSets.findSetByCode(code)) {
      throw new ConflictError(`attribute set code already exists: ${code}`);
    }
    const set = await this.attributeSets.createSet({ code, name: cmd.name, isDefault: cmd.isDefault });
    return { id: set.id.toString(), code: set.code, name: set.name };
  }
}
