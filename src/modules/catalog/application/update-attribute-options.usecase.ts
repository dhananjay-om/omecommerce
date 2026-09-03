import type { AttributeRepository, UpsertAttributeOptionInput } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { AttributeOptionView } from './dto.js';
import { toOptionView } from './list-attributes.usecase.js';

/** Options were originally create-time-only (CreateAttributeCommand.options, set once,
 *  no path to add or fix one afterward) — this is that path. Add-and-edit only, matching
 *  UpdateAttribute's own "not everything is safe to change post-creation" posture: it
 *  never deletes an option, since a real product/variant may already reference one by id. */
export class UpdateAttributeOptions {
  constructor(private readonly attributes: AttributeRepository) {}

  async execute(code: string, options: UpsertAttributeOptionInput[]): Promise<AttributeOptionView[]> {
    const attribute = await this.attributes.findByCode(code);
    if (!attribute) throw new NotFoundError('attribute', code);
    if (attribute.dataType !== 'SELECT' && attribute.dataType !== 'MULTISELECT') {
      throw new ValidationError(`options only apply to SELECT/MULTISELECT attributes, not ${attribute.dataType}`);
    }
    const rows = await this.attributes.upsertOptions(attribute.id, options);
    return rows.map(toOptionView);
  }
}
