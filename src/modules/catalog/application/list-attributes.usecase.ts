import type { AttributeRepository } from '../domain/repositories.js';
import type { AttributeView } from './dto.js';

/** Admin browse (plan/13 Phase L) — the reusable-attribute library + "assign existing attribute" picker. */
export class ListAttributes {
  constructor(private readonly attributes: AttributeRepository) {}

  async execute(): Promise<AttributeView[]> {
    const rows = await this.attributes.list();
    return rows.map((a) => ({
      id: a.id.toString(),
      code: a.code,
      label: a.label,
      dataType: a.dataType,
      inputType: a.inputType,
    }));
  }
}
