import type { AttributeRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { UpdateAttributeCommand, AttributeView } from './dto.js';
import { toAttributeView } from './list-attributes.usecase.js';

/** Scalar/flag updates only — code/dataType/inputType/options are immutable after creation (mirrors
 *  UpdateCategory: not everything is safe to change post-creation). This is how an attribute created
 *  without "Variant Forming" checked (or any other flag set wrong) gets corrected later, without having
 *  to delete-and-recreate it — which would also break any attribute set already referencing its code. */
export class UpdateAttribute {
  constructor(private readonly attributes: AttributeRepository) {}

  async execute(code: string, cmd: UpdateAttributeCommand): Promise<AttributeView> {
    const existing = await this.attributes.findByCode(code);
    if (!existing) throw new NotFoundError('attribute', code);

    const updated = await this.attributes.update(existing.id, cmd);
    return toAttributeView(updated);
  }
}
