import type { AttributeInfo, AttributeOptionInfo, AttributeRepository } from '../domain/repositories.js';
import type { AttributeView, AttributeOptionView } from './dto.js';

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

export function toOptionView(o: AttributeOptionInfo): AttributeOptionView {
  return { id: o.id.toString(), value: o.value, label: o.label, swatch: o.swatch, sortOrder: o.sortOrder };
}

/** Standalone attribute-option lookup (not scoped to any one attribute set's group
 *  assignment) — powers the coupon admin condition builder's "pick a Value" dropdown
 *  once an ATTRIBUTE condition's attribute has been chosen. */
export class ListAttributeOptions {
  constructor(private readonly attributes: AttributeRepository) {}

  async execute(code: string): Promise<AttributeOptionView[]> {
    const rows = await this.attributes.listOptions(code);
    return rows.map(toOptionView);
  }
}
