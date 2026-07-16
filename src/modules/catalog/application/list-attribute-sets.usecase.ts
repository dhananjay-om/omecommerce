import type { AttributeSetRepository } from '../domain/repositories.js';
import type { AttributeSetView } from './dto.js';

/** Admin browse (plan/12 Admin UI) — populates the attribute-set picker on the create-product form. */
export class ListAttributeSets {
  constructor(private readonly attributeSets: AttributeSetRepository) {}

  async execute(): Promise<AttributeSetView[]> {
    const sets = await this.attributeSets.listSets();
    return sets.map((s) => ({ id: s.id.toString(), code: s.code, name: s.name, isDefault: s.isDefault }));
  }
}
