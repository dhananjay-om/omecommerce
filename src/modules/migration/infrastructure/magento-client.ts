import type {
  SourceCatalogClient,
  SourceCustomerClient,
  SourceOrderClient,
  SourceProduct,
  SourceProductVariant,
  SourceProductOption,
  SourceCategory,
  SourceCustomer,
  SourceCustomerAddress,
  SourceOrder,
  SourceOrderLine,
  SourceOrderAddress,
} from '../domain/source-client.js';

const PAGE_SIZE = 100; // Magento's own search-criteria default max is commonly capped around here in practice

/**
 * Magento 2's REST API, authenticated with a pasted Integration Access
 * Token (Admin > System > Extensions > Integrations > a token generated
 * there) — used directly as a Bearer token on every call, no OAuth
 * install and no admin-credential exchange step, same "paste a token, not
 * full OAuth" decision already made for Shopify. Same deliberate
 * exception to this codebase's "always the vendor SDK" convention as
 * ShopifyClient, for the same reason: no Magento SDK fits a static-token
 * integration any better than plain authenticated REST calls do.
 *
 * Magento's product/order model is genuinely more complex than Shopify's
 * flatter shape, which shows up in a few real translation steps this
 * client does that ShopifyClient doesn't need:
 *  - A configurable product's variants live on separate child SIMPLE
 *    products, fetched via a dedicated children endpoint per product.
 *  - A configurable option's real value (e.g. "Blue") isn't inline
 *    anywhere — Magento only gives a numeric EAV option index, which has
 *    to be resolved via the attribute's own options endpoint. Cached once
 *    per distinct attribute for the life of this client instance, same
 *    "resolve once, reuse everywhere" precedent as ShopifyClient's own
 *    collection-membership cache.
 *  - There's no single order "financial status" / "fulfillment status"
 *    pair the way Shopify exposes — this client derives Shopify-
 *    equivalent vocabulary strings from Magento's own `status` +
 *    total_paid/total_refunded fields, so the shared worker's status
 *    mapping (mapFinancialStatus/mapFulfillmentStatus) stays genuinely
 *    channel-agnostic instead of growing a second per-channel switch.
 *  - Magento categories form a REAL tree (unlike Shopify's flat
 *    collections) — flattened here with `parentExternalId` populated
 *    correctly, though the current engine (catalog-migration.worker.ts)
 *    only creates flat/root-level local categories regardless of channel
 *    — a known, disclosed limitation, not something this connector alone
 *    can fix.
 */
export class MagentoClient implements SourceCatalogClient, SourceCustomerClient, SourceOrderClient {
  private readonly baseUrl: string;
  private attributeCodeById: Map<string, string> | null = null;
  private optionLabelsByAttributeCode = new Map<string, Map<string, string>>(); // attributeCode -> (value_index -> label)
  private attributeSetNameById: Map<string, string> | null = null;

  constructor(
    private readonly storeUrl: string,
    private readonly apiToken: string,
  ) {
    const host = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.baseUrl = `https://${host}/rest/V1`;
  }

  private async request(path: string): Promise<unknown> {
    // No documented public rate limit the way Shopify's leaky bucket is,
    // but a light pacing + 429/503 backoff is cheap insurance against
    // overwhelming a real store either way.
    await sleep(150);
    let res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.apiToken}`, Accept: 'application/json' },
    });
    if (res.status === 429 || res.status === 503) {
      await sleep(2000);
      res = await fetch(`${this.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${this.apiToken}`, Accept: 'application/json' },
      });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Magento API ${res.status} on ${path}: ${text.slice(0, 300)}`);
    }
    return res.json();
  }

  private searchPath(resource: string, page: number, extraFilters = ''): string {
    return `/${resource}?searchCriteria[pageSize]=${PAGE_SIZE}&searchCriteria[currentPage]=${page}${extraFilters}`;
  }

  async testConnection(): Promise<{ ok: true; storeName?: string } | { ok: false; message: string }> {
    try {
      const body = (await this.request('/store/storeViews')) as MagentoStoreView[];
      return { ok: true, storeName: body?.[0]?.name };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'could not reach Magento' };
    }
  }

  // --- Catalog ---------------------------------------------------------

  async countProducts(): Promise<number> {
    const body = (await this.request(this.searchPath('products', 1))) as MagentoSearchResult<MagentoProduct>;
    return body.total_count;
  }

  async sampleProducts(limit: number): Promise<SourceProduct[]> {
    const body = (await this.request(this.searchPath('products', 1))) as MagentoSearchResult<MagentoProduct>;
    const items = body.items.slice(0, limit);
    return Promise.all(items.map((p) => this.toSourceProduct(p)));
  }

  async listProducts(cursor: string | null): Promise<{ products: SourceProduct[]; nextCursor: string | null }> {
    const page = cursor ? Number(cursor) : 1;
    const body = (await this.request(this.searchPath('products', page))) as MagentoSearchResult<MagentoProduct>;
    const products = await Promise.all(body.items.map((p) => this.toSourceProduct(p)));
    const nextCursor = page * PAGE_SIZE < body.total_count ? String(page + 1) : null;
    return { products, nextCursor };
  }

  async listCategories(): Promise<SourceCategory[]> {
    const root = (await this.request('/categories')) as MagentoCategoryNode;
    const flat: SourceCategory[] = [];
    const walk = (node: MagentoCategoryNode, parentExternalId: string | null) => {
      // The synthetic root category (id usually 1, name "Root Catalog") and
      // the default top-level category aren't real merchandising
      // categories — skip a node with no name or the literal root, same
      // "don't create a fake category for platform scaffolding" posture.
      if (node.name && node.level >= 1) {
        flat.push({ externalId: String(node.id), name: node.name, parentExternalId });
      }
      const nextParent = node.name && node.level >= 1 ? String(node.id) : parentExternalId;
      for (const child of node.children_data ?? []) walk(child, nextParent);
    };
    walk(root, null);
    return flat;
  }

  /** Resolves an attribute_id (only given on configurable_product_options)
   *  to its attribute_code (needed for the options-label endpoint) — cached
   *  for the life of this client instance, since the same handful of
   *  configuring attributes (Color, Size, ...) repeats across every
   *  configurable product in a real catalog. */
  private async ensureAttributeCodeMap(): Promise<Map<string, string>> {
    if (this.attributeCodeById) return this.attributeCodeById;
    const map = new Map<string, string>();
    let page = 1;
    for (;;) {
      const body = (await this.request(this.searchPath('products/attributes', page))) as MagentoSearchResult<{
        attribute_id: number;
        attribute_code: string;
      }>;
      for (const a of body.items) map.set(String(a.attribute_id), a.attribute_code);
      if (page * PAGE_SIZE >= body.total_count) break;
      page++;
    }
    this.attributeCodeById = map;
    return map;
  }

  private async ensureOptionLabels(attributeCode: string): Promise<Map<string, string>> {
    const cached = this.optionLabelsByAttributeCode.get(attributeCode);
    if (cached) return cached;
    const options = (await this.request(`/products/attributes/${attributeCode}/options`)) as MagentoAttributeOption[];
    const map = new Map<string, string>();
    for (const o of options) if (o.value) map.set(o.value, o.label);
    this.optionLabelsByAttributeCode.set(attributeCode, map);
    return map;
  }

  private async ensureAttributeSetNameMap(): Promise<Map<string, string>> {
    if (this.attributeSetNameById) return this.attributeSetNameById;
    const map = new Map<string, string>();
    let page = 1;
    for (;;) {
      const body = (await this.request(this.searchPath('products/attribute-sets/sets/list', page))) as MagentoSearchResult<{
        attribute_set_id: number;
        attribute_set_name: string;
      }>;
      for (const s of body.items) map.set(String(s.attribute_set_id), s.attribute_set_name);
      if (page * PAGE_SIZE >= body.total_count) break;
      page++;
    }
    this.attributeSetNameById = map;
    return map;
  }

  /** Resolves each configurable_product_option into a real
   *  {name, attributeCode, valueLabelByIndex} triple — the one piece of
   *  real cross-referencing Magento's product API forces on a caller that
   *  Shopify's doesn't need at all (see this class's own doc comment). */
  private async resolveConfigurableOptions(
    rawOptions: MagentoConfigurableOption[],
  ): Promise<Array<{ name: string; attributeCode: string; valueLabelByIndex: Map<string, string> }>> {
    const codeById = await this.ensureAttributeCodeMap();
    const resolved = [];
    for (const opt of rawOptions) {
      const attributeCode = codeById.get(String(opt.attribute_id));
      if (!attributeCode) continue; // an attribute the code map didn't have — skip rather than guess
      const labels = await this.ensureOptionLabels(attributeCode);
      resolved.push({ name: opt.label, attributeCode, valueLabelByIndex: labels });
    }
    return resolved;
  }

  private async toSourceProduct(p: MagentoProduct): Promise<SourceProduct> {
    const custom = new Map((p.custom_attributes ?? []).map((a) => [a.attribute_code, a.value]));
    const categoryExternalIds = (p.extension_attributes?.category_links ?? []).map((c) => String(c.category_id));
    const images = (p.media_gallery_entries ?? []).map((m, i) => ({
      url: `${this.storeUrl.replace(/\/$/, '')}/media/catalog/product${m.file}`,
      position: m.position ?? i,
    }));
    const attributeSetNames = await this.ensureAttributeSetNameMap();
    const productType = p.attribute_set_id ? (attributeSetNames.get(String(p.attribute_set_id)) ?? null) : null;

    const isConfigurable = p.type_id === 'configurable' && (p.extension_attributes?.configurable_product_options?.length ?? 0) > 0;
    if (!isConfigurable) {
      // A Magento "simple" product carries its own price/sku directly — no
      // real variants exist, so this gets exactly one implicit variant,
      // same "every product has at least one variant" contract Shopify's
      // own SIMPLE products satisfy.
      const variant: SourceProductVariant = {
        externalId: String(p.id),
        sku: p.sku,
        price: p.price != null ? String(p.price) : null,
        compareAtPrice: null,
        inventoryQuantity: p.extension_attributes?.stock_item?.qty ?? null,
        optionValues: [],
      };
      return {
        externalId: String(p.id),
        sku: p.sku,
        title: p.name,
        bodyHtml: (custom.get('description') as string) ?? null,
        vendor: null,
        productType,
        tags: [],
        variants: [variant],
        options: [],
        images,
        categoryExternalIds,
      };
    }

    const resolvedOptions = await this.resolveConfigurableOptions(p.extension_attributes?.configurable_product_options ?? []);
    const options: SourceProductOption[] = resolvedOptions.map((o) => ({
      name: o.name,
      values: [...new Set([...o.valueLabelByIndex.values()])],
    }));

    let children: MagentoProduct[] = [];
    try {
      children = (await this.request(`/configurable-products/${encodeURIComponent(p.sku)}/children`)) as MagentoProduct[];
    } catch {
      // A configurable product with no reachable children (deleted/
      // disabled child, or a permissions gap on this integration token) —
      // falls through to zero variants rather than failing the whole
      // catalog read; the migration worker already treats a product with
      // no real variants as effectively unmigrable and will skip it.
    }

    const variants: SourceProductVariant[] = children.map((child) => {
      const childCustom = new Map((child.custom_attributes ?? []).map((a) => [a.attribute_code, a.value]));
      const optionValues = resolvedOptions.map((o) => {
        const rawValue = childCustom.get(o.attributeCode);
        return rawValue != null ? (o.valueLabelByIndex.get(String(rawValue)) ?? String(rawValue)) : '';
      });
      return {
        externalId: String(child.id),
        sku: child.sku,
        price: child.price != null ? String(child.price) : null,
        compareAtPrice: null,
        inventoryQuantity: child.extension_attributes?.stock_item?.qty ?? null,
        optionValues,
      };
    });

    return {
      externalId: String(p.id),
      sku: p.sku,
      title: p.name,
      bodyHtml: (custom.get('description') as string) ?? null,
      vendor: null,
      productType,
      tags: [],
      variants,
      options,
      images,
      categoryExternalIds,
    };
  }

  // --- Customers ---------------------------------------------------------

  async countCustomers(): Promise<number> {
    const body = (await this.request(this.searchPath('customers/search', 1))) as MagentoSearchResult<MagentoCustomer>;
    return body.total_count;
  }

  async listCustomers(cursor: string | null): Promise<{ customers: SourceCustomer[]; nextCursor: string | null }> {
    const page = cursor ? Number(cursor) : 1;
    const body = (await this.request(this.searchPath('customers/search', page))) as MagentoSearchResult<MagentoCustomer>;
    const customers = body.items.map(toSourceCustomer);
    const nextCursor = page * PAGE_SIZE < body.total_count ? String(page + 1) : null;
    return { customers, nextCursor };
  }

  // --- Orders --------------------------------------------------------------

  async countOrders(): Promise<number> {
    const body = (await this.request(this.searchPath('orders', 1))) as MagentoSearchResult<MagentoOrder>;
    return body.total_count;
  }

  async listOrders(cursor: string | null): Promise<{ orders: SourceOrder[]; nextCursor: string | null }> {
    const page = cursor ? Number(cursor) : 1;
    const body = (await this.request(this.searchPath('orders', page))) as MagentoSearchResult<MagentoOrder>;
    const orders = body.items.map(toSourceOrder);
    const nextCursor = page * PAGE_SIZE < body.total_count ? String(page + 1) : null;
    return { orders, nextCursor };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MagentoSearchResult<T> {
  items: T[];
  total_count: number;
}

interface MagentoStoreView {
  name?: string;
}

interface MagentoCategoryNode {
  id: number;
  name: string | null;
  level: number;
  children_data?: MagentoCategoryNode[];
}

interface MagentoConfigurableOption {
  attribute_id: string;
  label: string;
}

interface MagentoAttributeOption {
  label: string;
  value: string;
}

interface MagentoCustomAttribute {
  attribute_code: string;
  value: unknown;
}

interface MagentoStockItem {
  qty: number | null;
}

interface MagentoCategoryLink {
  category_id: string;
}

interface MagentoMediaGalleryEntry {
  file: string;
  position?: number;
}

interface MagentoProduct {
  id: number;
  sku: string;
  name: string;
  price: number | null;
  type_id: string; // 'simple' | 'configurable' | ...
  attribute_set_id?: number;
  custom_attributes?: MagentoCustomAttribute[];
  media_gallery_entries?: MagentoMediaGalleryEntry[];
  extension_attributes?: {
    category_links?: MagentoCategoryLink[];
    configurable_product_options?: MagentoConfigurableOption[];
    stock_item?: MagentoStockItem;
  };
}

interface MagentoAddress {
  id?: number;
  firstname?: string | null;
  lastname?: string | null;
  company?: string | null;
  street?: string[];
  city?: string | null;
  region?: { region?: string | null; region_code?: string | null } | string | null;
  country_id?: string | null;
  postcode?: string | null;
  telephone?: string | null;
  default_shipping?: boolean;
  default_billing?: boolean;
}

interface MagentoCustomer {
  id: number;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  addresses?: MagentoAddress[];
  extension_attributes?: { is_subscribed?: boolean };
}

function toSourceCustomerAddress(a: MagentoAddress): SourceCustomerAddress {
  const region = typeof a.region === 'string' ? a.region : (a.region?.region ?? a.region?.region_code ?? null);
  return {
    externalId: a.id != null ? String(a.id) : '',
    firstName: a.firstname ?? null,
    lastName: a.lastname ?? null,
    company: a.company ?? null,
    address1: a.street?.[0] ?? null,
    address2: a.street && a.street.length > 1 ? a.street.slice(1).join(', ') : null,
    city: a.city ?? null,
    province: region,
    countryCode: a.country_id ?? null,
    zip: a.postcode ?? null,
    phone: a.telephone ?? null,
    isDefault: Boolean(a.default_shipping || a.default_billing),
  };
}

function toSourceCustomer(c: MagentoCustomer): SourceCustomer {
  return {
    externalId: String(c.id),
    email: c.email,
    firstName: c.firstname,
    lastName: c.lastname,
    // Magento's Customer entity has no top-level phone field of its own
    // (only addresses do) — left null, same "field doesn't exist on this
    // platform" honesty as ShopifyClient's own tags/marketing-consent
    // fields carried but not always populated.
    phone: null,
    acceptsMarketing: c.extension_attributes?.is_subscribed ?? false,
    tags: [],
    addresses: (c.addresses ?? []).map(toSourceCustomerAddress),
  };
}

interface MagentoOrderItem {
  sku: string;
  name: string;
  qty_ordered: number;
  price: number;
  discount_amount?: number;
  tax_amount?: number;
  product_type?: string;
}

interface MagentoOrder {
  entity_id: number;
  increment_id: string;
  customer_email: string | null;
  order_currency_code: string;
  created_at: string;
  updated_at?: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  grand_total: number;
  total_paid?: number;
  total_refunded?: number;
  coupon_code?: string | null;
  payment?: { method?: string };
  items?: MagentoOrderItem[];
  billing_address?: MagentoAddress;
  extension_attributes?: {
    shipping_assignments?: Array<{ shipping?: { address?: MagentoAddress } }>;
  };
}

function toSourceOrderAddress(a: MagentoAddress | undefined): SourceOrderAddress | null {
  if (!a) return null;
  const region = typeof a.region === 'string' ? a.region : (a.region?.region ?? a.region?.region_code ?? null);
  return {
    name: [a.firstname, a.lastname].filter(Boolean).join(' ').trim() || null,
    company: a.company ?? null,
    address1: a.street?.[0] ?? null,
    address2: a.street && a.street.length > 1 ? a.street.slice(1).join(', ') : null,
    city: a.city ?? null,
    province: region,
    countryCode: a.country_id ?? null,
    zip: a.postcode ?? null,
    phone: a.telephone ?? null,
  };
}

/** Magento has no Shopify-style pre-split financial_status/
 *  fulfillment_status pair on an order — this derives the SAME shared
 *  vocabulary the worker's mapFinancialStatus/mapFulfillmentStatus
 *  already expect (see catalog-migration.worker.ts) from Magento's own
 *  `status` + total_paid/total_refunded fields, so that shared mapping
 *  code stays genuinely channel-agnostic instead of growing a second
 *  per-channel switch statement. */
function deriveMagentoFinancialStatus(o: MagentoOrder): string {
  const paid = o.total_paid ?? 0;
  const refunded = o.total_refunded ?? 0;
  if (o.grand_total > 0 && refunded >= o.grand_total) return 'refunded';
  if (refunded > 0) return 'partially_refunded';
  if (o.status === 'canceled') return 'voided';
  if (o.grand_total > 0 && paid >= o.grand_total) return 'paid';
  if (paid > 0) return 'partially_paid';
  return 'pending';
}

function deriveMagentoFulfillmentStatus(o: MagentoOrder): string | null {
  if (o.status === 'complete' || o.status === 'closed') return 'fulfilled';
  if (o.status === 'processing') return 'partial';
  return null;
}

function toSourceOrder(o: MagentoOrder): SourceOrder {
  const lineItems: SourceOrderLine[] = (o.items ?? [])
    // The parent row of a configurable-product line is a zero-price
    // grouping entry — the real qty/price/tax live on its child simple-
    // product row, which is what this keeps.
    .filter((li) => li.product_type !== 'configurable')
    .map((li) => ({
      sku: li.sku,
      title: li.name,
      qty: li.qty_ordered,
      unitPrice: String(li.price),
      totalDiscount: String(Math.abs(li.discount_amount ?? 0)),
      taxAmount: String(li.tax_amount ?? 0),
    }));

  const shippingAddress = toSourceOrderAddress(o.extension_attributes?.shipping_assignments?.[0]?.shipping?.address);

  return {
    externalId: String(o.entity_id),
    displayNumber: o.increment_id,
    email: o.customer_email,
    currency: o.order_currency_code,
    createdAt: o.created_at,
    cancelledAt: o.status === 'canceled' ? (o.updated_at ?? o.created_at) : null,
    closedAt: o.status === 'closed' ? (o.updated_at ?? null) : null,
    financialStatus: deriveMagentoFinancialStatus(o),
    fulfillmentStatus: deriveMagentoFulfillmentStatus(o),
    gateway: o.payment?.method ?? null,
    discountCode: o.coupon_code ?? null,
    subtotalPrice: String(o.subtotal),
    totalTax: String(o.tax_amount),
    totalShipping: String(o.shipping_amount),
    totalDiscounts: String(Math.abs(o.discount_amount ?? 0)),
    totalPrice: String(o.grand_total),
    lineItems,
    shippingAddress,
    billingAddress: toSourceOrderAddress(o.billing_address),
  };
}
