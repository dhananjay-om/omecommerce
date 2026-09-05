import type {
  SourceCatalogClient,
  SourceCustomerClient,
  SourceOrderClient,
  SourceProduct,
  SourceProductVariant,
  SourceCategory,
  SourceCustomer,
  SourceCustomerAddress,
  SourceOrder,
  SourceOrderLine,
  SourceOrderAddress,
} from '../domain/source-client.js';

const API_VERSION = '2024-10';
const PAGE_SIZE = 250; // Shopify's own max per page

/** Shopify's REST Admin API for a simple static-token integration doesn't
 *  warrant the official `@shopify/shopify-api` SDK — that package is built
 *  around an OAuth app's session/framework lifecycle (the flow this
 *  feature deliberately doesn't build, per the confirmed "pasted Admin API
 *  token, not full OAuth" decision), and would pull in a lot of unused
 *  machinery for what's otherwise plain authenticated REST calls. This is
 *  the one deliberate exception to this codebase's "always the vendor SDK,
 *  never raw fetch" convention (S3/OpenSearch/SMTP/OpenAI all integrate
 *  through their real SDK because those ARE genuinely complex protocols;
 *  "GET a JSON list with a static header" isn't). */
export class ShopifyClient implements SourceCatalogClient, SourceCustomerClient, SourceOrderClient {
  private readonly baseUrl: string;
  /** Lazily loaded once per client instance (see ensureCollectionMembership
   *  below) — product_id -> [collection_id, ...]. */
  private collectsByProductId: Map<string, string[]> | null = null;

  constructor(
    private readonly storeUrl: string,
    private readonly apiToken: string,
  ) {
    const host = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.baseUrl = `https://${host}/admin/api/${API_VERSION}`;
  }

  /**
   * Real bug fixed here: this used to read /collects.json once for the
   * whole store, which is cheap but only ever returns MANUAL collection
   * memberships — a Shopify smart/automated collection (rule-based, e.g.
   * "everything tagged Summer") has no collect rows at all, its membership
   * is computed dynamically. That silently produced empty categories: the
   * collection itself still got created locally (listCategories() sees
   * every collection regardless of type), but zero products ever linked to
   * it. Fixed by asking each collection's own /products.json endpoint
   * instead — the one Shopify endpoint that returns real membership
   * correctly for BOTH collection types. One paginated read per
   * collection (collections are typically tens, not thousands, so this
   * stays cheap) rather than one read for the whole store, but it's
   * actually correct.
   */
  private async ensureCollectionMembership(): Promise<Map<string, string[]>> {
    if (this.collectsByProductId) return this.collectsByProductId;
    const map = new Map<string, string[]>();
    const categories = await this.listCategories();
    for (const category of categories) {
      let path: string | null = `/collections/${category.externalId}/products.json?limit=${PAGE_SIZE}`;
      while (path) {
        const { body, linkHeader }: { body: unknown; linkHeader: string | null } = await this.request(path);
        for (const p of (body as { products: Array<{ id: number }> }).products ?? []) {
          const key = String(p.id);
          const list = map.get(key) ?? [];
          list.push(category.externalId);
          map.set(key, list);
        }
        const cursor = parseNextCursor(linkHeader);
        path = cursor ? `/collections/${category.externalId}/products.json?limit=${PAGE_SIZE}&page_info=${encodeURIComponent(cursor)}` : null;
      }
    }
    this.collectsByProductId = map;
    return map;
  }

  private async request(path: string): Promise<{ body: unknown; linkHeader: string | null }> {
    // Shopify's REST API is a leaky-bucket rate limiter (~40-call burst, ~2/sec
    // refill on most plans) — a real migration against a real store WILL be
    // throttled without this. A 429 is retried once, honoring Retry-After;
    // every other request is paced with a small fixed delay so the burst
    // bucket doesn't empty in the first place.
    await sleep(300);
    let res = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'X-Shopify-Access-Token': this.apiToken, Accept: 'application/json' },
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '2');
      await sleep(Math.max(1, retryAfter) * 1000);
      res = await fetch(`${this.baseUrl}${path}`, {
        headers: { 'X-Shopify-Access-Token': this.apiToken, Accept: 'application/json' },
      });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Shopify API ${res.status} on ${path}: ${text.slice(0, 300)}`);
    }
    return { body: await res.json(), linkHeader: res.headers.get('Link') };
  }

  async testConnection(): Promise<{ ok: true; storeName?: string } | { ok: false; message: string }> {
    try {
      const { body } = await this.request('/shop.json');
      const name = (body as { shop?: { name?: string } })?.shop?.name;
      return { ok: true, storeName: name };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'could not reach Shopify' };
    }
  }

  async countProducts(): Promise<number> {
    const { body } = await this.request('/products/count.json');
    return (body as { count: number }).count;
  }

  async sampleProducts(limit: number): Promise<SourceProduct[]> {
    const collects = await this.ensureCollectionMembership();
    const { body } = await this.request(`/products.json?limit=${Math.min(limit, PAGE_SIZE)}`);
    return ((body as { products: ShopifyProduct[] }).products ?? []).map((p) => toSourceProduct(p, collects));
  }

  async listProducts(cursor: string | null): Promise<{ products: SourceProduct[]; nextCursor: string | null }> {
    const collects = await this.ensureCollectionMembership();
    const path = cursor ? `/products.json?limit=${PAGE_SIZE}&page_info=${encodeURIComponent(cursor)}` : `/products.json?limit=${PAGE_SIZE}`;
    const { body, linkHeader } = await this.request(path);
    const products = ((body as { products: ShopifyProduct[] }).products ?? []).map((p) => toSourceProduct(p, collects));
    return { products, nextCursor: parseNextCursor(linkHeader) };
  }

  async listCategories(): Promise<SourceCategory[]> {
    // Shopify has two collection types, both flat (no real parent/child
    // hierarchy the REST API exposes) — merged into one flat list, every
    // `parentExternalId` null. A genuine nested-collection concept doesn't
    // exist on this platform the way it does in our own Category tree.
    const [custom, smart] = await Promise.all([
      this.request('/custom_collections.json?limit=250'),
      this.request('/smart_collections.json?limit=250'),
    ]);
    const customCollections = (custom.body as { custom_collections: ShopifyCollection[] }).custom_collections ?? [];
    const smartCollections = (smart.body as { smart_collections: ShopifyCollection[] }).smart_collections ?? [];
    return [...customCollections, ...smartCollections].map((c) => ({
      externalId: String(c.id),
      name: c.title,
      parentExternalId: null,
    }));
  }

  async countCustomers(): Promise<number> {
    const { body } = await this.request('/customers/count.json');
    return (body as { count: number }).count;
  }

  async listCustomers(cursor: string | null): Promise<{ customers: SourceCustomer[]; nextCursor: string | null }> {
    const path = cursor
      ? `/customers.json?limit=${PAGE_SIZE}&page_info=${encodeURIComponent(cursor)}`
      : `/customers.json?limit=${PAGE_SIZE}`;
    const { body, linkHeader } = await this.request(path);
    const customers = ((body as { customers: ShopifyCustomer[] }).customers ?? []).map(toSourceCustomer);
    return { customers, nextCursor: parseNextCursor(linkHeader) };
  }

  async countOrders(): Promise<number> {
    // status=any — the default only counts OPEN orders, silently excluding
    // every archived/cancelled/closed order, which would badly undercount
    // a real store's order history.
    const { body } = await this.request('/orders/count.json?status=any');
    return (body as { count: number }).count;
  }

  async listOrders(cursor: string | null): Promise<{ orders: SourceOrder[]; nextCursor: string | null }> {
    const path = cursor
      ? `/orders.json?status=any&limit=${PAGE_SIZE}&page_info=${encodeURIComponent(cursor)}`
      : `/orders.json?status=any&limit=${PAGE_SIZE}`;
    const { body, linkHeader } = await this.request(path);
    const orders = ((body as { orders: ShopifyOrder[] }).orders ?? []).map(toSourceOrder);
    return { orders, nextCursor: parseNextCursor(linkHeader) };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Shopify's cursor-based pagination puts the next page's token in the
 *  standard HTTP `Link` header (`<...page_info=XYZ>; rel="next"`), not the
 *  response body — this parses that out, or null on the last page. */
function parseNextCursor(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.split(',').find((part) => part.includes('rel="next"'));
  if (!match) return null;
  const urlMatch = match.match(/<([^>]+)>/);
  if (!urlMatch) return null;
  const url = new URL(urlMatch[1]!);
  return url.searchParams.get('page_info');
}

interface ShopifyVariant {
  id: number;
  sku: string | null;
  price: string | null;
  compare_at_price: string | null;
  inventory_quantity: number | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

interface ShopifyOption {
  name: string;
  values: string[];
}

interface ShopifyImage {
  src: string;
  position: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string | null;
  product_type: string | null;
  tags: string; // comma-separated
  variants: ShopifyVariant[];
  options: ShopifyOption[];
  images: ShopifyImage[];
}

interface ShopifyCollection {
  id: number;
  title: string;
}

interface ShopifyCustomerAddress {
  id: number;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  country_code: string | null;
  zip: string | null;
  phone: string | null;
  default?: boolean;
}

interface ShopifyCustomer {
  id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  tags: string; // comma-separated, same shape as ShopifyProduct.tags
  accepts_marketing: boolean;
  addresses: ShopifyCustomerAddress[];
  default_address: ShopifyCustomerAddress | null;
}

function toSourceCustomer(c: ShopifyCustomer): SourceCustomer {
  const defaultAddressId = c.default_address?.id;
  const addresses: SourceCustomerAddress[] = (c.addresses ?? []).map((a) => ({
    externalId: String(a.id),
    firstName: a.first_name,
    lastName: a.last_name,
    company: a.company,
    address1: a.address1,
    address2: a.address2,
    city: a.city,
    province: a.province,
    countryCode: a.country_code,
    zip: a.zip,
    phone: a.phone,
    isDefault: a.id === defaultAddressId,
  }));

  return {
    externalId: String(c.id),
    email: c.email,
    firstName: c.first_name,
    lastName: c.last_name,
    phone: c.phone,
    acceptsMarketing: c.accepts_marketing ?? false,
    tags: c.tags ? c.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    addresses,
  };
}

function toSourceProduct(p: ShopifyProduct, collectsByProductId: Map<string, string[]>): SourceProduct {
  // Shopify always gives a product at least one variant, even a "simple"
  // one with a single implicit "Default Title" option — real multi-variant
  // products have >1 real option/value. The engine (not this client)
  // decides SIMPLE vs CONFIGURABLE from `options`/`variants.length`, this
  // just carries the raw shape through unchanged.
  const variants: SourceProductVariant[] = (p.variants ?? []).map((v) => ({
    externalId: String(v.id),
    sku: v.sku,
    price: v.price,
    compareAtPrice: v.compare_at_price,
    inventoryQuantity: v.inventory_quantity,
    optionValues: [v.option1, v.option2, v.option3].filter((v): v is string => v !== null && v !== 'Default Title'),
  }));
  const realOptions = (p.options ?? []).filter((o) => !(o.values.length === 1 && o.values[0] === 'Default Title'));

  return {
    externalId: String(p.id),
    sku: p.variants?.[0]?.sku ?? null,
    title: p.title,
    bodyHtml: p.body_html,
    vendor: p.vendor,
    productType: p.product_type || null,
    tags: p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    variants,
    options: realOptions.map((o) => ({ name: o.name, values: o.values })),
    images: (p.images ?? []).map((img) => ({ url: img.src, position: img.position })),
    categoryExternalIds: collectsByProductId.get(String(p.id)) ?? [],
  };
}

interface ShopifyOrderAddress {
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  country_code: string | null;
  zip: string | null;
  phone: string | null;
}

interface ShopifyOrderLineTax {
  price: string;
}

interface ShopifyOrderLine {
  sku: string | null;
  title: string;
  quantity: number;
  price: string;
  total_discount: string;
  tax_lines: ShopifyOrderLineTax[];
}

interface ShopifyDiscountCode {
  code: string;
}

interface ShopifyShopMoney {
  shop_money?: { amount: string };
}

interface ShopifyOrder {
  id: number;
  name: string; // e.g. "#1001"
  email: string | null;
  currency: string;
  created_at: string;
  cancelled_at: string | null;
  closed_at: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  gateway: string | null;
  discount_codes: ShopifyDiscountCode[];
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  total_price: string;
  total_shipping_price_set?: ShopifyShopMoney;
  line_items: ShopifyOrderLine[];
  shipping_address: ShopifyOrderAddress | null;
  billing_address: ShopifyOrderAddress | null;
}

function toSourceOrderAddress(a: ShopifyOrderAddress | null): SourceOrderAddress | null {
  if (!a) return null;
  return {
    name: a.name ?? ([a.first_name, a.last_name].filter(Boolean).join(' ').trim() || null),
    company: a.company,
    address1: a.address1,
    address2: a.address2,
    city: a.city,
    province: a.province,
    countryCode: a.country_code,
    zip: a.zip,
    phone: a.phone,
  };
}

function toSourceOrder(o: ShopifyOrder): SourceOrder {
  const lineItems: SourceOrderLine[] = (o.line_items ?? []).map((li) => ({
    sku: li.sku,
    title: li.title,
    qty: li.quantity,
    unitPrice: li.price,
    totalDiscount: li.total_discount ?? '0',
    taxAmount: (li.tax_lines ?? []).reduce((sum, t) => sum + Number(t.price || '0'), 0).toFixed(4),
  }));

  return {
    externalId: String(o.id),
    displayNumber: o.name,
    email: o.email,
    currency: o.currency,
    createdAt: o.created_at,
    cancelledAt: o.cancelled_at,
    closedAt: o.closed_at,
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status,
    gateway: o.gateway,
    discountCode: o.discount_codes?.[0]?.code ?? null,
    subtotalPrice: o.subtotal_price,
    totalTax: o.total_tax,
    totalShipping: o.total_shipping_price_set?.shop_money?.amount ?? '0',
    totalDiscounts: o.total_discounts,
    totalPrice: o.total_price,
    lineItems,
    shippingAddress: toSourceOrderAddress(o.shipping_address),
    billingAddress: toSourceOrderAddress(o.billing_address),
  };
}
