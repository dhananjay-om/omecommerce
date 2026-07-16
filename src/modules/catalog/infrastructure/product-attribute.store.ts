import type { AttributeDataType } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  ProductAttributeStore,
  WriteScopedValueInput,
  ResolvedAttribute,
} from '../domain/repositories.js';

interface RawResolvedRow {
  attribute_id: bigint;
  code: string;
  data_type: string;
  value_text: string | null;
  value_int: bigint | null;
  value_decimal: string | null;
  value_datetime: Date | null;
  value_json: unknown | null;
}

export class PrismaProductAttributeStore implements ProductAttributeStore {
  constructor(private readonly db: Db) {}

  async upsertScopedValue(input: WriteScopedValueInput): Promise<void> {
    const { columns: c } = input;
    const jsonParam = c.valueJson === null ? null : JSON.stringify(c.valueJson);
    // Upsert against the NULLS NOT DISTINCT scope-unique index (plan/02 §6). Prisma's
    // typed upsert can't express a nullable compound key, so we use raw ON CONFLICT.
    await this.db.$executeRaw`
      INSERT INTO product_attribute_value
        (product_id, attribute_id, scope, website_id, store_id, store_view_id,
         value_text, value_int, value_decimal, value_datetime, value_json)
      VALUES (${input.productId}, ${input.attributeId}, ${input.scope}::"ScopeType",
              ${input.websiteId}, ${input.storeId}, ${input.storeViewId},
              ${c.valueText}, ${c.valueInt}, ${c.valueDecimal}::numeric,
              ${c.valueDatetime}, ${jsonParam}::jsonb)
      ON CONFLICT (product_id, attribute_id, scope, website_id, store_id, store_view_id)
      DO UPDATE SET
        value_text = EXCLUDED.value_text,
        value_int = EXCLUDED.value_int,
        value_decimal = EXCLUDED.value_decimal,
        value_datetime = EXCLUDED.value_datetime,
        value_json = EXCLUDED.value_json,
        updated_at = now()`;
  }

  async resolveForStoreView(
    productId: bigint,
    chain: { websiteId: bigint; storeId: bigint; storeViewId: bigint },
  ): Promise<ResolvedAttribute[]> {
    const rows = await this.db.$queryRaw<RawResolvedRow[]>`
      SELECT DISTINCT ON (v.attribute_id)
        v.attribute_id AS attribute_id,
        a.code AS code,
        a.data_type::text AS data_type,
        v.value_text,
        v.value_int,
        v.value_decimal::text AS value_decimal,
        v.value_datetime,
        v.value_json
      FROM product_attribute_value v
      JOIN attribute a ON a.id = v.attribute_id
      WHERE v.product_id = ${productId}
        AND (
          v.scope = 'GLOBAL'
          OR (v.scope = 'WEBSITE' AND v.website_id = ${chain.websiteId})
          OR (v.scope = 'STORE' AND v.store_id = ${chain.storeId})
          OR (v.scope = 'STORE_VIEW' AND v.store_view_id = ${chain.storeViewId})
        )
      ORDER BY v.attribute_id, v.scope_rank DESC`;

    return rows.map((r) => ({
      attributeId: r.attribute_id,
      code: r.code,
      dataType: r.data_type as AttributeDataType,
      columns: {
        valueText: r.value_text,
        valueInt: r.value_int,
        valueDecimal: r.value_decimal,
        valueDatetime: r.value_datetime,
        valueJson: r.value_json,
      },
    }));
  }

  async resolveGlobalValues(productId: bigint): Promise<ResolvedAttribute[]> {
    const rows = await this.db.$queryRaw<RawResolvedRow[]>`
      SELECT
        v.attribute_id AS attribute_id,
        a.code AS code,
        a.data_type::text AS data_type,
        v.value_text,
        v.value_int,
        v.value_decimal::text AS value_decimal,
        v.value_datetime,
        v.value_json
      FROM product_attribute_value v
      JOIN attribute a ON a.id = v.attribute_id
      WHERE v.product_id = ${productId} AND v.scope = 'GLOBAL'`;

    return rows.map((r) => ({
      attributeId: r.attribute_id,
      code: r.code,
      dataType: r.data_type as AttributeDataType,
      columns: {
        valueText: r.value_text,
        valueInt: r.value_int,
        valueDecimal: r.value_decimal,
        valueDatetime: r.value_datetime,
        valueJson: r.value_json,
      },
    }));
  }
}
