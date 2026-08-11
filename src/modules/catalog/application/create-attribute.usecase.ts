import type { AttributeRepository } from '../domain/repositories.js';
import { ConflictError } from '../../../shared/domain/errors.js';
import type { CreateAttributeCommand, AttributeView } from './dto.js';
import { toAttributeView } from './list-attributes.usecase.js';

export class CreateAttribute {
  constructor(private readonly attributes: AttributeRepository) {}

  async execute(cmd: CreateAttributeCommand): Promise<AttributeView> {
    const code = cmd.code.trim();
    if (await this.attributes.findByCode(code)) {
      throw new ConflictError(`attribute code already exists: ${code}`);
    }
    const attribute = await this.attributes.create({ ...cmd, code });
    return toAttributeView(attribute);
  }
}
