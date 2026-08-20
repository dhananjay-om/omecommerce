import type {
  ProductRepository,
  ProductVariantRepository,
  AttributeSetRepository,
  AttributeRepository,
} from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { toVariantView } from './list-product-variants.usecase.js';
import type { GenerateVariantsCommand, GenerateVariantsResult } from './dto.js';

interface ResolvedAxisOption {
  attributeId: bigint;
  optionId: bigint;
  optionValue: string;
}

/**
 * Bulk-generates the Cartesian product of the chosen axis attributes' option values as new
 * ProductVariant rows — the Magento-style "configurations" grid. Only attributes assigned to the
 * product's own attribute set, flagged isVariantForming, and of dataType SELECT are eligible axes
 * (the same three facts the admin UI's axis picker filters on, re-validated here since the picker
 * is just UI — the actual guard has to live here).
 *
 * Idempotent: combinations that already exist as a variant on this product are silently skipped,
 * not duplicated, so re-running generate after adding one more color only creates the new combos.
 */
export class GenerateProductVariants {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: ProductVariantRepository,
    private readonly attributeSets: AttributeSetRepository,
    private readonly attributes: AttributeRepository,
  ) {}

  async execute(cmd: GenerateVariantsCommand): Promise<GenerateVariantsResult> {
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', cmd.productPublicId);
    if (product.props.type !== 'CONFIGURABLE') {
      throw new ValidationError('only CONFIGURABLE products can have generated variants', [
        { path: 'type', message: 'product type must be CONFIGURABLE' },
      ]);
    }
    if (cmd.axes.length === 0) {
      throw new ValidationError('at least one axis is required', [{ path: 'axes', message: 'required' }]);
    }

    const setDetail = await this.attributeSets.getSetDetail(product.props.attributeSetId);
    if (!setDetail) throw new NotFoundError('attribute set', product.props.attributeSetId.toString());
    const assignedByCode = new Map(setDetail.groups.flatMap((g) => g.attributes).map((a) => [a.code, a]));

    const axisOptionLists: ResolvedAxisOption[][] = [];
    for (const axis of cmd.axes) {
      const assigned = assignedByCode.get(axis.attributeCode);
      if (!assigned) throw new NotFoundError('attribute assigned to this product\'s attribute set', axis.attributeCode);
      if (!assigned.isVariantForming) {
        throw new ValidationError(`attribute is not marked as variant-forming: ${axis.attributeCode}`, [
          { path: 'axes', message: 'not variant-forming' },
        ]);
      }
      if (assigned.dataType !== 'SELECT') {
        throw new ValidationError(`only SELECT attributes can be variant axes: ${axis.attributeCode}`, [
          { path: 'axes', message: 'must be a SELECT attribute' },
        ]);
      }

      const chosenOptionIds = new Set(axis.optionIds);
      const options = assigned.options.filter((o) => chosenOptionIds.has(o.id.toString()));
      if (options.length === 0) {
        throw new ValidationError(`no valid options selected for axis: ${axis.attributeCode}`, [
          { path: 'axes', message: 'at least one option required' },
        ]);
      }
      // AttributeSetAttributeDetail (from getSetDetail) doesn't carry the attribute's own internal
      // id — only its code/label/options — so resolve it separately to write VariantAxisValue rows.
      const attribute = await this.attributes.findByCode(axis.attributeCode);
      if (!attribute) throw new NotFoundError('attribute', axis.attributeCode);
      axisOptionLists.push(
        options.map((o) => ({
          attributeId: attribute.id,
          optionId: o.id,
          optionValue: o.value,
        })),
      );
    }

    // Cartesian product across all chosen axes.
    let combos: ResolvedAxisOption[][] = [[]];
    for (const optionList of axisOptionLists) {
      const next: ResolvedAxisOption[][] = [];
      for (const combo of combos) {
        for (const option of optionList) next.push([...combo, option]);
      }
      combos = next;
    }

    const existing = await this.variants.existingAxisCombos(product.props.id);
    const comboKey = (combo: ResolvedAxisOption[]) =>
      combo
        .map((c) => `${c.attributeId}:${c.optionId}`)
        .sort()
        .join(',');
    const toCreate = combos.filter((combo) => !existing.has(comboKey(combo)));
    const skipped = combos.length - toCreate.length;

    const slugify = (value: string) =>
      value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const inputs = toCreate.map((combo) => ({
      sku: [product.props.sku, ...combo.map((c) => slugify(c.optionValue))].join('-'),
      axisValues: combo.map((c) => ({ attributeId: c.attributeId, optionId: c.optionId })),
    }));

    const created = await this.variants.bulkCreate(product.props.id, inputs);
    return { created: created.length, skipped, variants: created.map(toVariantView) };
  }
}
