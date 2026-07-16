import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * The full Order vertical slice over HTTP (live DB): checkout saga (happy path +
 * payment-decline compensation), fulfillment, refund, cancel. Gated on INTEGRATION=1.
 * Cart/checkout routes are unauthenticated storefront APIs (plain `request(app)`);
 * everything else is `/admin/v1` and goes through `admin` (bearer-token-carrying).
 */
describe.skipIf(!process.env.INTEGRATION)('order API (live DB)', () => {
  const app = createApp();
  let attributeSetId = '';
  let storeViewId = '';
  let admin: ReturnType<typeof adminRequest>;

  async function createVariant(sku: string, price: string): Promise<string> {
    const created = await admin
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku, attributeSetId, status: 'ACTIVE' });
    expect(created.status).toBe(201);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    await admin.post('/admin/v1/price-lists').send({ code: `PL-${sku}`, name: sku, currency: 'USD', priority: 0 });
    await admin.put(`/admin/v1/price-lists/PL-${sku}/prices`).send({ variantId: variant.publicId, price });
    return variant.publicId;
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE order_return_line, order_return, fulfillment_line, fulfillment, payment_transaction,
       order_tax_line, order_address, order_line, "order", cart_line, cart,
       tax_class, shipping_method, price_tier, product_price, price_list,
       stock_reservation, stock_movement, stock_item, product,
       customer_address, customer RESTART IDENTITY CASCADE`,
    );
    const set = await prisma.attributeSet.upsert({
      where: { code: 'order-test-set' },
      update: {},
      create: { code: 'order-test-set', name: 'Order Test Set' },
    });
    attributeSetId = set.id.toString();

    await prisma.currency.upsert({
      where: { code: 'USD' },
      update: {},
      create: { code: 'USD', symbol: '$', minorUnits: 2, name: 'US Dollar' },
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

    await admin.post('/admin/v1/warehouses').send({ code: 'ORD-WH', name: 'Order Warehouse' });
    // WarehouseResolver.resolveForStore() only falls back to "first active
    // warehouse by id" when NO store_warehouse mapping exists for the store at
    // all — once ANY other test file creates one (e.g. stage3-infra.test.ts),
    // that mapping wins regardless of file execution order, silently pointing
    // this file's checkouts at a warehouse with none of ITS stock. Claim an
    // explicit, deterministic mapping for this file's own warehouse instead of
    // depending on the no-mapping fallback (implementation-dependent behavior a
    // test shouldn't rely on cross-file-order-independent correctness on).
    const orderWarehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: 'ORD-WH' } });
    await prisma.storeWarehouse.deleteMany({ where: { storeId: store.id } });
    await prisma.storeWarehouse.create({ data: { storeId: store.id, warehouseId: orderWarehouse.id, priority: 0 } });
    await admin
      .post('/admin/v1/shipping-methods')
      .send({ code: 'STANDARD', name: 'Standard Shipping', flatRate: '5.00', currency: 'USD' });
    await admin.post('/admin/v1/tax-classes').send({ code: 'STANDARD-TAX', name: 'Standard Tax', rate: '0.10' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const address = {
    name: 'Jane Doe',
    line1: '123 Main St',
    city: 'Springfield',
    postalCode: '12345',
    country: 'US',
  };

  it('completes checkout end-to-end: cart -> reserve -> order -> paid, stock deducted', async () => {
    const variantId = await createVariant('ORD-SKU-1', '20.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 10, reason: 'PURCHASE' });

    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    expect(cart.status).toBe(201);
    const cartId = cart.body.data.publicId;

    const addLine = await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 2 });
    expect(addLine.status).toBe(200);
    expect(addLine.body.data.lines).toHaveLength(1);

    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'jane@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'STANDARD',
        paymentMethod: 'test_card',
      });
    expect(checkout.status).toBe(201);
    const order = checkout.body.data;
    expect(order.financialStatus).toBe('PAID');
    expect(order.status).toBe('PROCESSING');
    expect(order.subtotal).toBe('40.0000'); // 20.00 * 2
    expect(order.shippingTotal).toBe('5.0000');
    // no tax_class assigned to the product -> tax should be 0
    expect(order.taxTotal).toBe('0.0000');
    expect(order.grandTotal).toBe('45.0000'); // 40 + 0 + 5

    // stock: on_hand deducted by the committed reservation (10 -> 8), reserved back to 0
    const stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'ORD-WH' });
    expect(stock.body.data).toEqual({ onHand: 8, reserved: 0, available: 8 });

    // GET order by publicId works too
    const fetched = await admin.get(`/admin/v1/orders/${order.publicId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.orderNumber).toBe(order.orderNumber);
  });

  it('a cart created for a logged-in customer produces an order carrying that customerId', async () => {
    const variantId = await createVariant('ORD-SKU-CUST-1', '10.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 5, reason: 'PURCHASE' });

    await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'us_retail', email: 'order-customer@example.com', password: 'correct-horse-battery' });
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'order-customer@example.com', password: 'correct-horse-battery' });
    const customerPublicId = login.body.data.customerPublicId as string;

    const cart = await request(app).post('/store/v1/carts').send({ storeViewId, customerPublicId });
    expect(cart.status).toBe(201);
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'order-customer@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'STANDARD',
        paymentMethod: 'test_card',
      });
    expect(checkout.status).toBe(201);

    const orderRow = await prisma.order.findFirstOrThrow({ where: { publicId: checkout.body.data.publicId } });
    const customerRow = await prisma.customer.findFirstOrThrow({ where: { publicId: customerPublicId } });
    expect(orderRow.customerId).toBe(customerRow.id);
  });

  it('a guest checkout (no customerPublicId) produces an order with customerId=null', async () => {
    const variantId = await createVariant('ORD-SKU-GUEST-1', '10.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 5, reason: 'PURCHASE' });

    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'guest@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'STANDARD',
        paymentMethod: 'test_card',
      });
    expect(checkout.status).toBe(201);
    const orderRow = await prisma.order.findFirstOrThrow({ where: { publicId: checkout.body.data.publicId } });
    expect(orderRow.customerId).toBeNull();
  });

  it('applies tax when the product has a tax class assigned', async () => {
    const variantId = await createVariant('ORD-SKU-TAX-1', '100.00');
    const taxClass = await prisma.taxClass.findFirstOrThrow({ where: { code: 'STANDARD-TAX' } });
    await prisma.product.update({ where: { sku: 'ORD-SKU-TAX-1' }, data: { taxClassId: taxClass.id } });
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 5, reason: 'PURCHASE' });

    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'jane@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'STANDARD',
        paymentMethod: 'test_card',
      });
    expect(checkout.status).toBe(201);
    // 100.00 subtotal * 10% tax = 10.0000; grand = 100 + 10 + 5 = 115
    expect(checkout.body.data.taxTotal).toBe('10.0000');
    expect(checkout.body.data.grandTotal).toBe('115.0000');
  });

  it('compensates correctly on a declined payment: reservation released, stock untouched, cart consumed', async () => {
    const variantId = await createVariant('ORD-SKU-DECLINE-1', '15.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 10, reason: 'PURCHASE' });

    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 3 });

    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'jane@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'STANDARD',
        paymentMethod: 'test_card',
        testScenario: 'decline',
      });
    expect(checkout.status).toBe(402);
    expect(checkout.body.type).toContain('payment-declined');

    // stock: reservation was released, never committed -> on_hand unchanged, reserved back to 0
    const stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'ORD-WH' });
    expect(stock.body.data).toEqual({ onHand: 10, reserved: 0, available: 10 });

    // the cart was consumed by the atomic claim (its "slot" doesn't resurrect on failure) —
    // re-adding a line to the same cart id should 404 as it's no longer ACTIVE-findable-for-checkout
    const recheckout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'jane@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'STANDARD',
        paymentMethod: 'test_card',
      });
    expect(recheckout.status).toBe(409);
    expect(recheckout.body.type).toContain('cart-not-active');
  });

  it('rejects checkout when inventory is insufficient, without side effects', async () => {
    const variantId = await createVariant('ORD-SKU-INSUFFICIENT-1', '10.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 2, reason: 'PURCHASE' });

    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 5 });

    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'jane@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'STANDARD',
        paymentMethod: 'test_card',
      });
    expect(checkout.status).toBe(409);
    expect(checkout.body.type).toContain('insufficient-stock');

    const stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'ORD-WH' });
    expect(stock.body.data).toEqual({ onHand: 2, reserved: 0, available: 2 });
  });

  it('fulfills, then refunds with restock, updating statuses and stock', async () => {
    const variantId = await createVariant('ORD-SKU-FULFILL-1', '30.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 10, reason: 'PURCHASE' });

    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 4 });
    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'jane@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'STANDARD',
        paymentMethod: 'test_card',
      });
    const orderPublicId = checkout.body.data.publicId;

    const fulfill = await admin
      .post(`/admin/v1/orders/${orderPublicId}/fulfillments`)
      .send({ lines: [{ sku: 'ORD-SKU-FULFILL-1', qty: 4 }] });
    expect(fulfill.status).toBe(200);
    expect(fulfill.body.data.fulfillmentStatus).toBe('FULFILLED');
    expect(fulfill.body.data.lines[0].fulfilledQty).toBe(4);

    // over-fulfilling beyond qty is rejected
    const overFulfill = await admin
      .post(`/admin/v1/orders/${orderPublicId}/fulfillments`)
      .send({ lines: [{ sku: 'ORD-SKU-FULFILL-1', qty: 1 }] });
    expect(overFulfill.status).toBe(409);

    const refund = await admin
      .post(`/admin/v1/orders/${orderPublicId}/refunds`)
      .send({ lines: [{ sku: 'ORD-SKU-FULFILL-1', qty: 2 }], restock: true });
    expect(refund.status).toBe(200);
    expect(refund.body.data.financialStatus).toBe('PARTIALLY_REFUNDED');
    expect(refund.body.data.lines[0].refundedQty).toBe(2);

    // stock: on_hand was 6 after checkout (10-4), restock +2 -> 8
    const stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'ORD-WH' });
    expect(stock.body.data.onHand).toBe(8);

    // full refund of the remainder -> financialStatus REFUNDED
    const finalRefund = await admin
      .post(`/admin/v1/orders/${orderPublicId}/refunds`)
      .send({ lines: [{ sku: 'ORD-SKU-FULFILL-1', qty: 2 }], restock: false });
    expect(finalRefund.body.data.financialStatus).toBe('REFUNDED');
  });

  it('cancels an unfulfilled order: full refund + restock + status CANCELLED', async () => {
    const variantId = await createVariant('ORD-SKU-CANCEL-1', '25.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 10, reason: 'PURCHASE' });

    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 3 });
    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'jane@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'STANDARD',
        paymentMethod: 'test_card',
      });
    const orderPublicId = checkout.body.data.publicId;

    const cancel = await admin.post(`/admin/v1/orders/${orderPublicId}/cancel`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.financialStatus).toBe('REFUNDED');
    expect(cancel.body.data.status).toBe('CANCELLED');

    const stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'ORD-WH' });
    expect(stock.body.data.onHand).toBe(10); // fully restocked
  });

  it('lists orders with pagination, status filter, and email filter', async () => {
    const all = await admin.get('/admin/v1/orders');
    expect(all.status).toBe(200);
    expect(all.body.data.total).toBeGreaterThanOrEqual(6); // every prior checkout in this file
    expect(all.body.data.page).toBe(1);

    const paged = await admin.get('/admin/v1/orders').query({ page: 1, pageSize: 2 });
    expect(paged.body.data.orders).toHaveLength(2);
    expect(paged.body.data.pageSize).toBe(2);

    const cancelled = await admin.get('/admin/v1/orders').query({ status: 'CANCELLED' });
    expect(cancelled.body.data.orders.length).toBeGreaterThanOrEqual(1);
    expect(cancelled.body.data.orders.every((o: { status: string }) => o.status === 'CANCELLED')).toBe(true);

    const byEmail = await admin.get('/admin/v1/orders').query({ email: 'guest@example.com' });
    expect(byEmail.body.data.orders).toHaveLength(1);
    expect(byEmail.body.data.orders[0].email).toBe('guest@example.com');
  });
});
