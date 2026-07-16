import type { AttributeSetRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { AttributeSetDetailView } from './dto.js';

export class GetAttributeSetDetail {
  constructor(private readonly attributeSets: AttributeSetRepository) {}

  async execute(id: string): Promise<AttributeSetDetailView> {
    if (!/^\d+$/.test(id)) {
      throw new ValidationError('invalid attribute set id', [{ path: 'id', message: 'expected numeric id' }]);
    }
    const detail = await this.attributeSets.getSetDetail(BigInt(id));
    if (!detail) throw new NotFoundError('AttributeSet', id);

    return {
      id: detail.id.toString(),
      code: detail.code,
      name: detail.name,
      isDefault: detail.isDefault,
      groups: detail.groups.map((g) => ({
        id: g.id.toString(),
        name: g.name,
        sortOrder: g.sortOrder,
        attributes: g.attributes.map((a) => ({
          code: a.code,
          label: a.label,
          dataType: a.dataType,
          inputType: a.inputType,
          isRequired: a.isRequired,
          sortOrder: a.sortOrder,
          options: a.options.map((o) => ({
            id: o.id.toString(),
            value: o.value,
            label: o.label,
            swatch: o.swatch,
            sortOrder: o.sortOrder,
          })),
        })),
      })),
    };
  }
}
