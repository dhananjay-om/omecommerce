import type { AttributeRepository } from '../domain/repositories.js';
import { ConflictError } from '../../../shared/domain/errors.js';
import type { CreateAttributeCommand, AttributeView } from './dto.js';

export class CreateAttribute {
  constructor(private readonly attributes: AttributeRepository) {}

  async execute(cmd: CreateAttributeCommand): Promise<AttributeView> {
    const code = cmd.code.trim();
    if (await this.attributes.findByCode(code)) {
      throw new ConflictError(`attribute code already exists: ${code}`);
    }
    const attribute = await this.attributes.create({ ...cmd, code });
    return {
      id: attribute.id.toString(),
      code: attribute.code,
      label: attribute.label,
      dataType: attribute.dataType,
      inputType: attribute.inputType,
    };
  }
}
