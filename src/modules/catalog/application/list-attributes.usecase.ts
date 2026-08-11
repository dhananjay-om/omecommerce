import type { AttributeInfo, AttributeRepository } from '../domain/repositories.js';
import type { AttributeView } from './dto.js';

/** Shared AttributeInfo -> AttributeView mapping, reused by ListAttributes/CreateAttribute/UpdateAttribute
 *  so the reusable-attribute library, its create response, and its edit response never drift apart. */
export function toAttributeView(a: AttributeInfo): AttributeView {
  return {
    id: a.id.toString(),
    code: a.code,
    label: a.label,
    dataType: a.dataType,
    inputType: a.inputType,
    isRequired: a.isRequired,
    isFilterable: a.isFilterable,
    isSearchable: a.isSearchable,
    isComparable: a.isComparable,
    isSortable: a.isSortable,
    isVisiblePdp: a.isVisiblePdp,
    isVisiblePlp: a.isVisiblePlp,
    usedInSearch: a.usedInSearch,
    usedInLayeredNav: a.usedInLayeredNav,
    isVariantForming: a.isVariantForming,
  };
}

/** Admin browse (plan/13 Phase L) — the reusable-attribute library + "assign existing attribute" picker. */
export class ListAttributes {
  constructor(private readonly attributes: AttributeRepository) {}

  async execute(): Promise<AttributeView[]> {
    const rows = await this.attributes.list();
    return rows.map(toAttributeView);
  }
}
