import { describe, it, expect } from 'vitest';
import { toColumns, fromRow } from '../../src/modules/catalog/domain/attribute-value.js';
import { ValidationError } from '../../src/shared/domain/errors.js';

describe('attribute value type mapping', () => {
  it('maps NUMBER -> valueInt and reads back', () => {
    const cols = toColumns('NUMBER', 16);
    expect(cols.valueInt).toBe(16n);
    expect(fromRow('NUMBER', cols)).toBe(16);
  });

  it('maps TEXT -> valueText', () => {
    const cols = toColumns('TEXT', 'hello');
    expect(cols.valueText).toBe('hello');
    expect(fromRow('TEXT', cols)).toBe('hello');
  });

  it('maps BOOLEAN -> valueInt 0/1 and reads back boolean', () => {
    expect(toColumns('BOOLEAN', true).valueInt).toBe(1n);
    expect(fromRow('BOOLEAN', toColumns('BOOLEAN', false))).toBe(false);
  });

  it('maps DECIMAL as string', () => {
    expect(toColumns('DECIMAL', '19.99').valueDecimal).toBe('19.99');
  });

  it('maps MULTISELECT/JSON to valueJson', () => {
    const cols = toColumns('MULTISELECT', [1, 2, 3]);
    expect(cols.valueJson).toEqual([1, 2, 3]);
    expect(fromRow('MULTISELECT', cols)).toEqual([1, 2, 3]);
  });

  it('rejects wrong type', () => {
    expect(() => toColumns('NUMBER', 'not-a-number')).toThrow(ValidationError);
    expect(() => toColumns('TEXT', 123)).toThrow(ValidationError);
    expect(() => toColumns('BOOLEAN', 'yes')).toThrow(ValidationError);
  });
});
