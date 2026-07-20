#!/usr/bin/env node
// Seeds a small, coherent demo catalog (categories, brands, products with
// real prices/stock/images) against a running local backend — the dev DB is
// otherwise empty or full of leftover integration-test fixtures (product/
// category tables get TRUNCATEd by several test files' beforeAll hooks), and
// every storefront phase from here on needs something real to browse.
// Idempotent: skips creating a category/brand/product that already exists by
// name/sku, so it's safe to re-run after a test suite wipes the DB. Usage:
//   node scripts/seed-demo-data.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, 'seed-assets');
const API = process.env.API_BASE_URL ?? 'http://localhost:4100';

async function api(method, apiPath, body, token) {
  const res = await fetch(`${API}${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${apiPath} -> ${res.status}: ${text}`);
  return json?.data;
}

const login = await api('POST', '/admin/v1/auth/login', { email: 'admin@ome.local', password: 'dev-only-password-change-me' });
const token = login.token;
const A = (method, apiPath, body) => api(method, apiPath, body, token);

async function ensure(getList, matchFn, create) {
  const existing = (await getList()).find(matchFn);
  if (existing) return existing;
  return create();
}

console.log('logged in');

const warehouse = await ensure(
  () => A('GET', '/admin/v1/warehouses'),
  (w) => w.code === 'WH-MAIN',
  () => A('POST', '/admin/v1/warehouses', { code: 'WH-MAIN', name: 'Main Warehouse' }),
);
const priceList = await ensure(
  () => A('GET', '/admin/v1/price-lists'),
  (p) => p.code === 'PL-DEMO-USD',
  () => A('POST', '/admin/v1/price-lists', { code: 'PL-DEMO-USD', name: 'Demo USD', currency: 'USD', priority: 0 }),
);
console.log('warehouse + price list ok:', warehouse.code, priceList.code);

async function ensureCategory(name, parentId) {
  return ensure(
    () => A('GET', '/store/v1/categories'),
    (c) => c.nameDefault === name && (c.parentId ?? null) === (parentId ?? null),
    () => A('POST', '/admin/v1/categories', { nameDefault: name, parentId: parentId ?? null }),
  );
}

const electronics = await ensureCategory('Electronics');
const fashion = await ensureCategory('Fashion');
const home = await ensureCategory('Home & Kitchen');
const laptops = await ensureCategory('Laptops', electronics.publicId);
const phones = await ensureCategory('Phones', electronics.publicId);
const mens = await ensureCategory('Men', fashion.publicId);
const womens = await ensureCategory('Women', fashion.publicId);
console.log('categories ok');

async function ensureBrand(name, description) {
  return ensure(
    () => A('GET', '/store/v1/brands'),
    (b) => b.name === name,
    () => A('POST', '/admin/v1/brands', { name, description }),
  );
}
const novaBrand = await ensureBrand('Nova Electronics', 'Premium consumer electronics.');
const urbanBrand = await ensureBrand('Urban Threads', 'Everyday apparel, thoughtfully made.');
const homeBrand = await ensureBrand('HomeStyle', 'Small appliances for a better kitchen.');
console.log('brands ok');

const attributeSets = await A('GET', '/admin/v1/attribute-sets');
const defaultSet = attributeSets.find((s) => s.isDefault) ?? attributeSets[0];

const PRODUCTS = [
  { sku: 'DEMO-LAPTOP-PRO-14', name: 'Laptop Pro 14', price: '1499.00', category: laptops, brand: novaBrand, image: 'laptop-pro-14' },
  { sku: 'DEMO-LAPTOP-AIR-13', name: 'Laptop Air 13', price: '999.00', category: laptops, brand: novaBrand, image: 'laptop-air-13' },
  { sku: 'DEMO-PHONE-X1', name: 'Smartphone X1', price: '899.00', category: phones, brand: novaBrand, image: 'smartphone-x1' },
  { sku: 'DEMO-PHONE-LITE', name: 'Smartphone Lite', price: '449.00', category: phones, brand: novaBrand, image: 'smartphone-lite' },
  { sku: 'DEMO-EARBUDS', name: 'Wireless Earbuds', price: '129.00', category: electronics, brand: novaBrand, image: 'wireless-earbuds' },
  { sku: 'DEMO-MENS-JACKET', name: "Men's Jacket", price: '89.00', category: mens, brand: urbanBrand, image: 'mens-jacket' },
  { sku: 'DEMO-WOMENS-SNEAKERS', name: "Women's Sneakers", price: '75.00', category: womens, brand: urbanBrand, image: 'womens-sneakers' },
  { sku: 'DEMO-TSHIRT', name: 'Classic T-Shirt', price: '25.00', category: mens, brand: urbanBrand, image: 'classic-tshirt' },
  { sku: 'DEMO-COFFEE-MAKER', name: 'Coffee Maker', price: '59.00', category: home, brand: homeBrand, image: 'coffee-maker' },
];

for (const p of PRODUCTS) {
  const existingList = await A('GET', `/admin/v1/products?search=${encodeURIComponent(p.sku)}`);
  let publicId = existingList.products.find((x) => x.sku === p.sku)?.publicId;

  if (!publicId) {
    const product = await A('POST', '/admin/v1/products', {
      type: 'SIMPLE',
      sku: p.sku,
      attributeSetId: defaultSet.id,
      status: 'ACTIVE',
      visibility: 'BOTH',
      nameDefault: p.name,
    });
    publicId = product.publicId;

    const detail = await A('GET', `/admin/v1/products/${publicId}`);
    const variantId = detail.variants[0].publicId;
    await A('PUT', `/admin/v1/price-lists/${priceList.code}/prices`, { variantId, price: p.price });
    await A('POST', '/admin/v1/inventory/adjustments', {
      variantId,
      warehouseCode: warehouse.code,
      delta: 50,
      reason: 'PURCHASE',
      note: 'Demo seed',
    });
    await A('PUT', `/admin/v1/products/${publicId}/categories`, { categoryIds: [p.category.publicId] });
    await A('PATCH', `/admin/v1/products/${publicId}`, { brandId: p.brand.publicId });

    const upload = await A('POST', '/admin/v1/media/uploads', { filename: `${p.image}.jpg`, mimeType: 'image/jpeg' });
    const bytes = readFileSync(path.join(IMAGES_DIR, `${p.image}.jpg`));
    const putRes = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: bytes });
    if (!putRes.ok) throw new Error(`image PUT failed for ${p.sku}: ${putRes.status}`);
    const asset = await A('POST', '/admin/v1/media', {
      storageKey: upload.storageKey,
      mimeType: 'image/jpeg',
      bytes: bytes.length,
      width: 800,
      height: 800,
    });
    await A('POST', `/admin/v1/products/${publicId}/media`, { mediaPublicId: asset.publicId });
    console.log(`seeded ${p.sku}`);
  } else {
    console.log(`skipped ${p.sku} (already exists)`);
  }
}

await A('POST', '/admin/v1/search/reindex');
console.log('reindexed. done.');
