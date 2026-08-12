import { describe, it, expect } from 'vitest';
import { Product } from '../../src/modules/catalog/domain/product.js';
import { ValidationError } from '../../src/shared/domain/errors.js';

describe('Product aggregate', () => {
  it('derives isDigital/isVirtual from type', () => {
    expect(Product.create({ type: 'DIGITAL', sku: 'D1', attributeSetId: 1n }).props.isDigital).toBe(true);
    expect(Product.create({ type: 'VIRTUAL', sku: 'V1', attributeSetId: 1n }).props.isVirtual).toBe(true);
    const simple = Product.create({ type: 'SIMPLE', sku: 'S1', attributeSetId: 1n }).props;
    expect(simple.isDigital).toBe(false);
    expect(simple.isVirtual).toBe(false);
  });

  it('defaults status=DRAFT, visibility=BOTH', () => {
    const p = Product.create({ type: 'SIMPLE', sku: 'S2', attributeSetId: 1n }).props;
    expect(p.status).toBe('DRAFT');
    expect(p.visibility).toBe('BOTH');
  });

  it('rejects empty sku', () => {
    expect(() => Product.create({ type: 'SIMPLE', sku: '   ', attributeSetId: 1n })).toThrow(ValidationError);
  });
});
