import type { CreateCouponConditionInput, ProductLookup, CategoryLookup, AttributeLookup } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { CouponConditionCommand } from './dto.js';

/** Translates the admin's publicId/code-based condition rows into the internal
 *  bigint ids CouponCondition actually stores — shared by CreateCoupon and
 *  UpdateCoupon so this resolution logic exists exactly once. */
export async function resolveConditions(
  commands: CouponConditionCommand[],
  lookups: { products: ProductLookup; categories: CategoryLookup; attributes: AttributeLookup },
): Promise<CreateCouponConditionInput[]> {
  const resolved: CreateCouponConditionInput[] = [];
  for (const cmd of commands) {
    if (cmd.conditionType === 'PRODUCT') {
      if (!cmd.productId) {
        throw new ValidationError('a PRODUCT condition requires productId', [{ path: 'conditions', message: 'productId required' }]);
      }
      const product = await lookups.products.byPublicId(cmd.productId);
      if (!product) throw new NotFoundError('Product', cmd.productId);
      resolved.push({ conditionType: 'PRODUCT', productId: product.id });
    } else if (cmd.conditionType === 'CATEGORY') {
      if (!cmd.categoryId) {
        throw new ValidationError('a CATEGORY condition requires categoryId', [{ path: 'conditions', message: 'categoryId required' }]);
      }
      const category = await lookups.categories.byPublicId(cmd.categoryId);
      if (!category) throw new NotFoundError('Category', cmd.categoryId);
      resolved.push({ conditionType: 'CATEGORY', categoryId: category.id });
    } else if (cmd.conditionType === 'ATTRIBUTE') {
      if (!cmd.attributeCode || !cmd.attributeValue) {
        throw new ValidationError('an ATTRIBUTE condition requires attributeCode and attributeValue', [
          { path: 'conditions', message: 'attributeCode and attributeValue required' },
        ]);
      }
      const attribute = await lookups.attributes.byCode(cmd.attributeCode);
      if (!attribute) throw new NotFoundError('Attribute', cmd.attributeCode);
      // For SELECT/MULTISELECT, attributeValue must be a real AttributeOption id —
      // catch a typo/garbage value here rather than letting it silently never match
      // anything at evaluate() time.
      if (attribute.dataType === 'SELECT' || attribute.dataType === 'MULTISELECT') {
        const optionId = /^\d+$/.test(cmd.attributeValue) ? BigInt(cmd.attributeValue) : null;
        const label = optionId !== null ? await lookups.attributes.optionLabel(optionId) : null;
        if (!label) {
          throw new ValidationError(`attributeValue must be a valid option id for attribute ${cmd.attributeCode}`, [
            { path: 'conditions', message: 'unknown attribute option id' },
          ]);
        }
      }
      resolved.push({ conditionType: 'ATTRIBUTE', attributeId: attribute.id, attributeValue: cmd.attributeValue });
    }
  }
  return resolved;
}
