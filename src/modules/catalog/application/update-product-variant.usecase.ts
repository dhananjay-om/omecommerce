import type { ProductVariantRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toVariantView } from './list-product-variants.usecase.js';
import type { UpdateVariantCommand, VariantView } from './dto.js';

/** Rename a variant's SKU and/or flip its ACTIVE/INACTIVE status — patch semantics, only fields
 * present in the command are touched. Axis values are set once at generation time and not
 * editable here (changing which Size/Color a variant represents would orphan its price/stock
 * history under a now-mislabeled combination — delete and regenerate instead). */
export class UpdateProductVariant {
  constructor(private readonly variants: ProductVariantRepository) {}

  async execute(cmd: UpdateVariantCommand): Promise<VariantView> {
    const variant = await this.variants.findByPublicId(cmd.variantPublicId);
    if (!variant) throw new NotFoundError('variant', cmd.variantPublicId);

    const updated = await this.variants.update(variant.id, { sku: cmd.sku, status: cmd.status });
    return toVariantView(updated);
  }
}
