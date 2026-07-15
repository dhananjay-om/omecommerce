import { AttributeDataType } from '@prisma/client';
import { ValidationError } from '../../../shared/domain/errors.js';

/** The typed value columns of product_attribute_value (plan/01 §2.2). */
export interface AttributeValueColumns {
  valueText: string | null;
  valueInt: bigint | null;
  valueDecimal: string | null;
  valueDatetime: Date | null;
  valueJson: unknown | null;
}

const EMPTY: AttributeValueColumns = {
  valueText: null,
  valueInt: null,
  valueDecimal: null,
  valueDatetime: null,
  valueJson: null,
};

const TEXT_TYPES = new Set<AttributeDataType>([
  'TEXT',
  'TEXTAREA',
  'URL',
  'EMAIL',
  'PHONE',
  'COLOR',
  'RICHTEXT',
]);
const REF_TYPES = new Set<AttributeDataType>([
  'REF_PRODUCT',
  'REF_CATEGORY',
  'REF_BRAND',
  'REF_CMS',
  'REF_COLLECTION',
  'REF_CUSTOMER',
  'SELECT',
]);
const JSON_TYPES = new Set<AttributeDataType>(['JSON', 'MULTISELECT', 'IMAGE', 'FILE']);

/** Map an incoming value to the correct typed column for its attribute data type. */
export function toColumns(dataType: AttributeDataType, value: unknown): AttributeValueColumns {
  const fail = (msg: string): never => {
    throw new ValidationError(`invalid value for ${dataType}: ${msg}`, [{ path: 'value', message: msg }]);
  };
  if (value === null || value === undefined) fail('value required');

  if (TEXT_TYPES.has(dataType)) {
    if (typeof value !== 'string') fail('expected string');
    return { ...EMPTY, valueText: value as string };
  }
  if (dataType === 'NUMBER' || REF_TYPES.has(dataType)) {
    const n = typeof value === 'number' || typeof value === 'bigint' ? value : Number(value);
    if (!Number.isFinite(Number(n))) fail('expected integer');
    return { ...EMPTY, valueInt: BigInt(Math.trunc(Number(n))) };
  }
  if (dataType === 'DECIMAL') {
    const s = String(value);
    if (!/^-?\d+(\.\d+)?$/.test(s)) fail('expected decimal');
    return { ...EMPTY, valueDecimal: s };
  }
  if (dataType === 'BOOLEAN') {
    if (typeof value !== 'boolean') fail('expected boolean');
    return { ...EMPTY, valueInt: value ? 1n : 0n };
  }
  if (dataType === 'DATE' || dataType === 'DATETIME') {
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) fail('expected date');
    return { ...EMPTY, valueDatetime: d };
  }
  if (JSON_TYPES.has(dataType)) {
    return { ...EMPTY, valueJson: value };
  }
  return fail('unsupported data type');
}

/** Read a stored row back into a plain JS value for API output. */
export function fromRow(dataType: AttributeDataType, cols: AttributeValueColumns): unknown {
  if (TEXT_TYPES.has(dataType)) return cols.valueText;
  if (dataType === 'NUMBER' || REF_TYPES.has(dataType)) {
    return cols.valueInt === null ? null : Number(cols.valueInt);
  }
  if (dataType === 'DECIMAL') return cols.valueDecimal;
  if (dataType === 'BOOLEAN') return cols.valueInt === null ? null : cols.valueInt === 1n;
  if (dataType === 'DATE' || dataType === 'DATETIME') return cols.valueDatetime;
  if (JSON_TYPES.has(dataType)) return cols.valueJson;
  return null;
}
