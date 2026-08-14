import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * The Coupon vertical slice over HTTP (live DB): admin CRUD, cart apply/remove,
 * and the full checkout-path redemption (discount actually lands on
 * Order.discountTotal/couponCode + OrderInvoice.discountTotal, usage-limit
 * exhaustion, and the guarded-UPDATE race). Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('coupon API (live DB)', () => {
  const app = createApp();
  let attributeSetId = '';
  let storeViewId = '';
  let admin: ReturnType<typeof adminRequest>;

  async function createVariant(sku: string, price: string): Promise<string> {
    const created = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku, attributeSetId, status: 'ACTIVE' });
    expect(created.status).toBe(201);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    await admin.post('/admin/v1/price-lists').send({ code: `PL-${sku}`, name: sku, currency: 'USD', priority: 0 });
    await admin.put(`/admin/v1/price-lists/PL-${sku}/prices`).send({ variantId: variant.publicId, price });
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId: variant.publicId, warehouseCode: 'CPN-WH', delta: 100, reason: 'PURCHASE' });
    return variant.publicId;
  }

  async function newCart(): Promise<string> {
    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    expect(cart.status).toBe(201);
    return cart.body.data.publicId;
  }

  async function productPublicIdFor(sku: string): Promise<string> {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    const product = await prisma.product.findUniqueOrThrow({ where: { id: variant.productId } });
    return product.publicId;
  }

  const address = { name: 'Jane Doe', line1: '123 Main St', city: 'Springfield', postalCode: '12345', country: 'US' };

  async function checkout(cartId: string, overrides: Record<string, unknown> = {}) {
    return request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'jane@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'STANDARD',
        paymentMethod: 'test_card',
        ...overrides,
      });
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE coupon_redemption, order_tax_line, order_address, order_line, "order", cart_line, cart,
       tax_class, shipping_method, price_tier, product_price, price_list, coupon,
       stock_reservation, stock_movement, stock_item, product,
       customer_address, customer RESTART IDENTITY CASCADE`,
    );
    const set = await prisma.attributeSet.upsert({
      where: { code: 'coupon-test-set' },
      update: {},
      create: { code: 'coupon-test-set', name: 'Coupon Test Set' },
    });
    attributeSetId = set.id.toString();

    await prisma.currency.upsert({
      where: { code: 'USD' },
      update: {},
      create: { code: 'USD', symbol: '$', minorUnits: 2, name: 'US Dollar' },
    });
    await prisma.currency.upsert({
      where: { code: 'EUR' },
      update: {},
      create: { code: 'EUR', symbol: '€', minorUnits: 2, name: 'Euro' },
    });
    const website = await prisma.website.upsert({
      where: { code: 'us_retail' },
      update: {},
      create: { code: 'us_retail', name: 'US Retail', baseCurrency: 'USD', isDefault: true },
    });
    const store = await prisma.store.upsert({
      where: { websiteId_code: { websiteId: website.id, code: 'main' } },
      update: {},
      create: { websiteId: website.id, code: 'main', name: 'Main' },
    });
    const lang = await prisma.language.upsert({
      where: { code: 'en-US' },
      update: {},
      create: { code: 'en-US', name: 'English', nativeName: 'English' },
    });
    const sv = await prisma.storeView.upsert({
      where: { storeId_code: { storeId: store.id, code: 'en' } },
      update: {},
      create: { storeId: store.id, code: 'en', languageId: lang.id, currency: 'USD' },
    });
    storeViewId = sv.id.toString();

    admin = adminRequest(app, await getAdminToken(app));

    await admin.post('/admin/v1/warehouses').send({ code: 'CPN-WH', name: 'Coupon Warehouse' });
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: 'CPN-WH' } });
    await prisma.storeWarehouse.deleteMany({ where: { storeId: store.id } });
    await prisma.storeWarehouse.create({ data: { storeId: store.id, warehouseId: warehouse.id, priority: 0 } });
    await admin.post('/admin/v1/shipping-methods').send({ code: 'STANDARD', name: 'Standard Shipping', flatRate: '5.00', currency: 'USD' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // --- Admin CRUD ---

  it('creates, lists, updates, and deletes a coupon', async () => {
    const created = await admin.post('/admin/v1/coupons').send({ code: 'crud10', discountType: 'PERCENTAGE', value: '10' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ code: 'CRUD10', discountType: 'PERCENTAGE', value: '10.0000', usageCount: 0, isActive: true });

    const list = await admin.get('/admin/v1/coupons');
    expect(list.status).toBe(200);
    expect(list.body.data.map((c: { code: string }) => c.code)).toContain('CRUD10');

    const updated = await admin.patch('/admin/v1/coupons/CRUD10').send({ description: 'ten percent off', isActive: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ description: 'ten percent off', isActive: false });

    const deleted = await admin.delete('/admin/v1/coupons/CRUD10');
    expect(deleted.status).toBe(204);
    const listAfter = await admin.get('/admin/v1/coupons');
    expect(listAfter.body.data.map((c: { code: string }) => c.code)).not.toContain('CRUD10');
  });

  it('rejects a duplicate coupon code with 409', async () => {
    await admin.post('/admin/v1/coupons').send({ code: 'DUPE1', discountType: 'PERCENTAGE', value: '5' });
    const dup = await admin.post('/admin/v1/coupons').send({ code: 'DUPE1', discountType: 'PERCENTAGE', value: '5' });
    expect(dup.status).toBe(409);
  });

  it('rejects a FIXED_AMOUNT coupon with no currency (422), and a PERCENTAGE coupon with a currency (422)', async () => {
    const noCurrency = await admin.post('/admin/v1/coupons').send({ code: 'BADFIX', discountType: 'FIXED_AMOUNT', value: '5' });
    expect(noCurrency.status).toBe(422);

    const withCurrency = await admin.post('/admin/v1/coupons').send({ code: 'BADPCT', discountType: 'PERCENTAGE', value: '5', currency: 'USD' });
    expect(withCurrency.status).toBe(422);
  });

  // --- Cart apply/remove ---

  it('applies a percentage coupon to a cart and shows the discount preview; remove clears it', async () => {
    await admin.post('/admin/v1/coupons').send({ code: 'CARTPCT', discountType: 'PERCENTAGE', value: '10' });
    const variantId = await createVariant('CPN-SKU-1', '100.00');
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

    const applied = await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'cartpct' });
    expect(applied.status).toBe(200);
    expect(applied.body.data.couponCode).toBe('CARTPCT');
    expect(applied.body.data.discountTotal).toBe('10.0000');
    expect(applied.body.data.estimatedTotal).toBe('90.0000');
    expect(applied.body.data.couponError).toBeNull();

    const removed = await request(app).post(`/store/v1/carts/${cartId}/actions/remove-coupon`).send({});
    expect(removed.status).toBe(200);
    expect(removed.body.data.couponCode).toBeNull();
    expect(removed.body.data.discountTotal).toBeNull();
    expect(removed.body.data.estimatedTotal).toBe('100.0000');
  });

  it('rejects applying an unknown coupon code with 404', async () => {
    const variantId = await createVariant('CPN-SKU-2', '50.00');
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });
    const res = await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'NOPE' });
    expect(res.status).toBe(404);
  });

  it('rejects applying a coupon to an empty cart with 422', async () => {
    const cartId = await newCart();
    const res = await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'CARTPCT' });
    expect(res.status).toBe(422);
  });

  it('rejects a coupon below its minSubtotal with 422', async () => {
    await admin.post('/admin/v1/coupons').send({ code: 'MIN50', discountType: 'FIXED_AMOUNT', value: '5', currency: 'USD', minSubtotal: '50' });
    const variantId = await createVariant('CPN-SKU-3', '20.00');
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });
    const res = await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'MIN50' });
    expect(res.status).toBe(422);
  });

  it('rejects an inactive coupon, one outside its date window, and one for the wrong currency', async () => {
    await admin.post('/admin/v1/coupons').send({ code: 'INACTIVE1', discountType: 'PERCENTAGE', value: '5', isActive: false });
    await admin.post('/admin/v1/coupons').send({ code: 'NOTYET', discountType: 'PERCENTAGE', value: '5', startsAt: '2099-01-01T00:00:00.000Z' });
    await admin.post('/admin/v1/coupons').send({ code: 'EXPIRED1', discountType: 'PERCENTAGE', value: '5', endsAt: '2000-01-01T00:00:00.000Z' });
    await admin.post('/admin/v1/coupons').send({ code: 'EURONLY', discountType: 'FIXED_AMOUNT', value: '5', currency: 'EUR' });

    const variantId = await createVariant('CPN-SKU-4', '20.00');
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

    expect((await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'INACTIVE1' })).status).toBe(409);
    expect((await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'NOTYET' })).status).toBe(409);
    expect((await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'EXPIRED1' })).status).toBe(409);
    expect((await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'EURONLY' })).status).toBe(422);
  });

  // --- Full checkout path ---

  it('checkout with a percentage coupon: discount lands on Order and OrderInvoice, usage count increments', async () => {
    await admin.post('/admin/v1/coupons').send({ code: 'CHECK10', discountType: 'PERCENTAGE', value: '10' });
    const variantId = await createVariant('CPN-SKU-5', '100.00');
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });
    await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'CHECK10' });

    const res = await checkout(cartId);
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.couponCode).toBe('CHECK10');
    expect(order.discountTotal).toBe('10.0000');
    expect(order.subtotal).toBe('100.0000');
    // subtotal(100) - discount(10) + tax(0) + shipping(5)
    expect(order.grandTotal).toBe('95.0000');

    const coupon = await admin.get('/admin/v1/coupons');
    const row = coupon.body.data.find((c: { code: string }) => c.code === 'CHECK10');
    expect(row.usageCount).toBe(1);

    const invoiced = await admin.post(`/admin/v1/orders/${order.publicId}/invoice`).send({});
    expect(invoiced.status).toBe(201);
    const invoice = invoiced.body.data.invoices.at(-1);
    expect(invoice.discountTotal).toBe('10.0000');
    // Invoices never include shipping (order-api.test.ts's own convention) —
    // subtotal(100) - discount(10) + tax(0), not the order's shipping-inclusive grandTotal.
    expect(invoice.grandTotal).toBe('90.0000');
  });

  it('checkout with a fixed-amount coupon clamps the discount so it never exceeds the subtotal', async () => {
    await admin.post('/admin/v1/coupons').send({ code: 'BIGFIX', discountType: 'FIXED_AMOUNT', value: '1000', currency: 'USD' });
    const variantId = await createVariant('CPN-SKU-6', '15.00');
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });
    await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'BIGFIX' });

    const res = await checkout(cartId);
    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe('15.0000');
    expect(res.body.data.discountTotal).toBe('15.0000'); // clamped, not 1000
    expect(res.body.data.grandTotal).toBe('5.0000'); // 15 - 15 + 0 tax + 5 shipping
  });

  it('exhausts a usage-limited coupon: first checkout succeeds, second is rejected', async () => {
    await admin.post('/admin/v1/coupons').send({ code: 'LIMIT1', discountType: 'PERCENTAGE', value: '10', usageLimit: 1 });
    const variantId = await createVariant('CPN-SKU-7', '20.00');

    const cart1 = await newCart();
    await request(app).post(`/store/v1/carts/${cart1}/lines`).send({ variantId, qty: 1 });
    await request(app).post(`/store/v1/carts/${cart1}/actions/apply-coupon`).send({ code: 'LIMIT1' });
    const first = await checkout(cart1);
    expect(first.status).toBe(201);

    const cart2 = await newCart();
    await request(app).post(`/store/v1/carts/${cart2}/lines`).send({ variantId, qty: 1 });
    // evaluate() at apply-time already sees usageCount=1 >= usageLimit=1 -> rejected here.
    const applySecond = await request(app).post(`/store/v1/carts/${cart2}/actions/apply-coupon`).send({ code: 'LIMIT1' });
    expect(applySecond.status).toBe(409);

    const coupon = await admin.get('/admin/v1/coupons');
    const row = coupon.body.data.find((c: { code: string }) => c.code === 'LIMIT1');
    expect(row.usageCount).toBe(1);
  });

  it('a concurrent race for the last use of a usage-limited coupon: exactly one checkout succeeds', async () => {
    await admin.post('/admin/v1/coupons').send({ code: 'RACE1', discountType: 'PERCENTAGE', value: '5', usageLimit: 1 });
    const variantId = await createVariant('CPN-SKU-8', '20.00');

    const cartA = await newCart();
    const cartB = await newCart();
    await request(app).post(`/store/v1/carts/${cartA}/lines`).send({ variantId, qty: 1 });
    await request(app).post(`/store/v1/carts/${cartB}/lines`).send({ variantId, qty: 1 });
    // Both apply while usageCount is still 0 — both pass the optimistic check.
    await request(app).post(`/store/v1/carts/${cartA}/actions/apply-coupon`).send({ code: 'RACE1' });
    await request(app).post(`/store/v1/carts/${cartB}/actions/apply-coupon`).send({ code: 'RACE1' });

    const [resA, resB] = await Promise.all([checkout(cartA), checkout(cartB)]);
    // One succeeds (201); the other's guarded redeem() UPDATE affects 0 rows,
    // throwing a clean 409 (CouponUsageLimitExceededError) — not a raw 500 — and
    // the whole checkout saga rejects it (stock reservation released too).
    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
    const succeeded = [resA, resB].filter((r) => r.status === 201);
    const failed = [resA, resB].filter((r) => r.status !== 201);
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.status).toBe(409);

    const coupon = await admin.get('/admin/v1/coupons');
    const row = coupon.body.data.find((c: { code: string }) => c.code === 'RACE1');
    expect(row.usageCount).toBe(1);
  });

  // --- Admin CRUD validation: targetType/conditions pairing ---

  it('rejects an ITEM-target coupon with zero conditions, and a CART-target coupon with conditions', async () => {
    const noConditions = await admin.post('/admin/v1/coupons').send({ code: 'ITEMNOCOND', discountType: 'PERCENTAGE', value: '10', targetType: 'ITEM' });
    expect(noConditions.status).toBe(422);

    const productPublicId = await productPublicIdFor('CPN-SKU-1'); // created by an earlier test
    const cartWithConditions = await admin.post('/admin/v1/coupons').send({
      code: 'CARTWITHCOND',
      discountType: 'PERCENTAGE',
      value: '10',
      targetType: 'CART',
      conditions: [{ conditionType: 'PRODUCT', productId: productPublicId }],
    });
    expect(cartWithConditions.status).toBe(422);
  });

  // --- Item targeting: PRODUCT / CATEGORY / ATTRIBUTE conditions ---

  it('an ITEM-target coupon with a PRODUCT condition discounts only the matching line', async () => {
    const variantA = await createVariant('CPN-ITEM-A', '50.00');
    const variantB = await createVariant('CPN-ITEM-B', '30.00');
    const productAPublicId = await productPublicIdFor('CPN-ITEM-A');

    const created = await admin.post('/admin/v1/coupons').send({
      code: 'ITEMPROD',
      discountType: 'PERCENTAGE',
      value: '20',
      targetType: 'ITEM',
      conditions: [{ conditionType: 'PRODUCT', productId: productAPublicId }],
    });
    expect(created.status).toBe(201);
    expect(created.body.data.targetType).toBe('ITEM');
    expect(created.body.data.conditions).toEqual([
      expect.objectContaining({ conditionType: 'PRODUCT', productId: productAPublicId }),
    ]);

    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId: variantA, qty: 1 });
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId: variantB, qty: 1 });

    const applied = await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'ITEMPROD' });
    expect(applied.status).toBe(200);
    // 20% of A's 50.00 only — not 20% of the 80.00 combined subtotal.
    expect(applied.body.data.discountTotal).toBe('10.0000');
    const lineA = applied.body.data.lines.find((l: { sku: string }) => l.sku === 'CPN-ITEM-A');
    const lineB = applied.body.data.lines.find((l: { sku: string }) => l.sku === 'CPN-ITEM-B');
    expect(lineA.discountAmount).toBe('10.0000');
    expect(lineB.discountAmount).toBeNull(); // never matched — no allocation entry at all

    const res = await checkout(cartId);
    expect(res.status).toBe(201);
    expect(res.body.data.discountTotal).toBe('10.0000');
    // subtotal(80) - discount(10) + tax(0) + shipping(5)
    expect(res.body.data.grandTotal).toBe('75.0000');
  });

  it('an ITEM-target coupon with a CATEGORY condition matches a product in a descendant category', async () => {
    const parent = await admin.post('/admin/v1/categories').send({ nameDefault: 'Coupon Test Clothing' });
    const child = await admin.post('/admin/v1/categories').send({ nameDefault: 'Coupon Test Shirts', parentId: parent.body.data.publicId });
    const variantId = await createVariant('CPN-CAT-1', '40.00');
    const productPublicId = await productPublicIdFor('CPN-CAT-1');
    await admin.put(`/admin/v1/products/${productPublicId}/categories`).send({ categoryIds: [child.body.data.publicId] });

    await admin.post('/admin/v1/coupons').send({
      code: 'ITEMCAT',
      discountType: 'PERCENTAGE',
      value: '25',
      targetType: 'ITEM',
      conditions: [{ conditionType: 'CATEGORY', categoryId: parent.body.data.publicId }], // ancestor of the product's assigned category
    });

    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });
    const applied = await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'ITEMCAT' });
    expect(applied.status).toBe(200);
    expect(applied.body.data.discountTotal).toBe('10.0000'); // 25% of 40.00
  });

  it('an ITEM-target coupon with an ATTRIBUTE condition matches only the option it names', async () => {
    await admin.post('/admin/v1/attributes').send({
      code: 'coupon-test-color',
      label: 'Color',
      dataType: 'SELECT',
      inputType: 'DROPDOWN',
      options: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
    });
    const options = await prisma.attributeOption.findMany({ where: { attribute: { code: 'coupon-test-color' } } });
    const redOptionId = options.find((o) => o.value === 'red')!.id.toString();
    const blueOptionId = options.find((o) => o.value === 'blue')!.id.toString();

    const variantRed = await createVariant('CPN-ATTR-RED', '60.00');
    const variantBlue = await createVariant('CPN-ATTR-BLUE', '60.00');
    const redProductPublicId = await productPublicIdFor('CPN-ATTR-RED');
    const blueProductPublicId = await productPublicIdFor('CPN-ATTR-BLUE');
    await admin.put(`/admin/v1/products/${redProductPublicId}/attributes/bulk`).send({ values: [{ attributeCode: 'coupon-test-color', value: Number(redOptionId) }] });
    await admin.put(`/admin/v1/products/${blueProductPublicId}/attributes/bulk`).send({ values: [{ attributeCode: 'coupon-test-color', value: Number(blueOptionId) }] });

    await admin.post('/admin/v1/coupons').send({
      code: 'ITEMATTR',
      discountType: 'FIXED_AMOUNT',
      value: '5',
      currency: 'USD',
      targetType: 'ITEM',
      conditions: [{ conditionType: 'ATTRIBUTE', attributeCode: 'coupon-test-color', attributeValue: redOptionId }],
    });

    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId: variantRed, qty: 1 });
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId: variantBlue, qty: 1 });
    const applied = await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'ITEMATTR' });
    expect(applied.status).toBe(200);
    expect(applied.body.data.discountTotal).toBe('5.0000');
    const redLine = applied.body.data.lines.find((l: { sku: string }) => l.sku === 'CPN-ATTR-RED');
    const blueLine = applied.body.data.lines.find((l: { sku: string }) => l.sku === 'CPN-ATTR-BLUE');
    expect(redLine.discountAmount).toBe('5.0000');
    expect(blueLine.discountAmount).toBeNull();
  });

  it('an ITEM-target coupon with zero eligible items in the cart is rejected with 422', async () => {
    const variantBlue = await createVariant('CPN-ATTR-BLUE-2', '10.00');
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId: variantBlue, qty: 1 });
    const applied = await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'ITEMATTR' }); // matches RED only
    expect(applied.status).toBe(422);
  });

  // --- Auto-apply ---

  it('an auto-apply coupon applies itself with no code entered, and shows up as such on a plain cart read', async () => {
    await admin.post('/admin/v1/coupons').send({ code: 'AUTO15', discountType: 'PERCENTAGE', value: '15', isAutoApply: true });
    const variantId = await createVariant('CPN-AUTO-1', '40.00');
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

    const cart = await request(app).get(`/store/v1/carts/${cartId}`);
    expect(cart.status).toBe(200);
    expect(cart.body.data.couponCode).toBe('AUTO15');
    expect(cart.body.data.couponIsAutoApplied).toBe(true);
    expect(cart.body.data.discountTotal).toBe('6.0000');

    const res = await checkout(cartId);
    expect(res.status).toBe(201);
    expect(res.body.data.couponCode).toBe('AUTO15');
    expect(res.body.data.discountTotal).toBe('6.0000');

    const coupon = await admin.get('/admin/v1/coupons');
    const row = coupon.body.data.find((c: { code: string }) => c.code === 'AUTO15');
    expect(row.usageCount).toBe(1);
  });

  it('when several auto-apply coupons are eligible, the one giving the greatest discount is chosen', async () => {
    await admin.post('/admin/v1/coupons').send({ code: 'AUTOSMALL', discountType: 'PERCENTAGE', value: '5', isAutoApply: true });
    await admin.post('/admin/v1/coupons').send({ code: 'AUTOBIG', discountType: 'PERCENTAGE', value: '30', isAutoApply: true });
    const variantId = await createVariant('CPN-AUTO-2', '20.00');
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

    const cart = await request(app).get(`/store/v1/carts/${cartId}`);
    expect(cart.body.data.couponCode).toBe('AUTOBIG');
    expect(cart.body.data.discountTotal).toBe('6.0000'); // 30% of 20.00
  });

  it('a manually-applied code always wins over an eligible auto-apply coupon', async () => {
    await admin.post('/admin/v1/coupons').send({ code: 'AUTOWINS', discountType: 'PERCENTAGE', value: '50', isAutoApply: true });
    await admin.post('/admin/v1/coupons').send({ code: 'MANUALWINS', discountType: 'PERCENTAGE', value: '10' });
    const variantId = await createVariant('CPN-AUTO-3', '20.00');
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });
    await request(app).post(`/store/v1/carts/${cartId}/actions/apply-coupon`).send({ code: 'MANUALWINS' });

    const cart = await request(app).get(`/store/v1/carts/${cartId}`);
    expect(cart.body.data.couponCode).toBe('MANUALWINS');
    expect(cart.body.data.couponIsAutoApplied).toBe(false);
    expect(cart.body.data.discountTotal).toBe('2.0000'); // 10% of 20.00, not 50%
  });

  it('a concurrent race for the last use of a limited auto-apply coupon: both checkouts succeed, only one is discounted', async () => {
    // Deactivate every other auto-apply coupon created by earlier tests in this
    // file (AUTO15/AUTOSMALL/AUTOBIG/AUTOWINS) so AUTORACE is the sole eligible
    // auto-apply candidate — otherwise findBestAutoApply would pick whichever of
    // those has the greatest value instead, defeating the point of this test.
    for (const code of ['AUTO15', 'AUTOSMALL', 'AUTOBIG', 'AUTOWINS']) {
      await admin.patch(`/admin/v1/coupons/${code}`).send({ isActive: false });
    }
    await admin.post('/admin/v1/coupons').send({ code: 'AUTORACE', discountType: 'PERCENTAGE', value: '10', isAutoApply: true, usageLimit: 1 });
    const variantId = await createVariant('CPN-AUTO-RACE', '20.00');

    const cartA = await newCart();
    const cartB = await newCart();
    await request(app).post(`/store/v1/carts/${cartA}/lines`).send({ variantId, qty: 1 });
    await request(app).post(`/store/v1/carts/${cartB}/lines`).send({ variantId, qty: 1 });
    // No apply-coupon call at all — both carts pick this up purely via auto-apply.

    const [resA, resB] = await Promise.all([checkout(cartA), checkout(cartB)]);
    // Unlike a manually-entered code losing this same race (409, whole checkout
    // aborted), an auto-applied coupon losing it must never fail the checkout —
    // the loser just completes at full price instead.
    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    const discounted = [resA, resB].filter((r) => Number(r.body.data.discountTotal) > 0);
    const fullPrice = [resA, resB].filter((r) => Number(r.body.data.discountTotal) === 0);
    expect(discounted).toHaveLength(1);
    expect(fullPrice).toHaveLength(1);
    expect(discounted[0]!.body.data.couponCode).toBe('AUTORACE');
    expect(fullPrice[0]!.body.data.couponCode).toBeNull();
    expect(fullPrice[0]!.body.data.grandTotal).toBe('25.0000'); // 20 + 5 shipping, no discount reverted back in

    const coupon = await admin.get('/admin/v1/coupons');
    const row = coupon.body.data.find((c: { code: string }) => c.code === 'AUTORACE');
    expect(row.usageCount).toBe(1); // exactly one redemption, even though both checkouts succeeded
  });
});
