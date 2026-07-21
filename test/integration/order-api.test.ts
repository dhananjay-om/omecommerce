import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * The full Order vertical slice over HTTP (live DB): checkout saga (happy path +
 * payment-decline compensation), fulfillment, refund, cancel, and cart-line
 * enrichment (sku/name/price/imageUrl/lineTotal + cart subtotal, plan/14 Phase
 * 5a). Gated on INTEGRATION=1. Cart/checkout routes are unauthenticated
 * storefront APIs (plain `request(app)`); everything else is `/admin/v1` and
 * goes through `admin` (bearer-token-carrying).
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

  it('reads a cart, updates a line qty via re-POST (upsert), and removes a line via DELETE', async () => {
    const variantId = await createVariant('ORD-SKU-CART', '10.00');

    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    const cartId = cart.body.data.publicId;
    expect(cart.body.data.subtotal).toBeNull();

    const added = await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });
    expect(added.status).toBe(200);
    expect(added.body.data.lines).toEqual([
      { id: expect.any(String), variantId, qty: 1, sku: 'ORD-SKU-CART', name: 'ORD-SKU-CART', price: expect.any(String), imageUrl: null, lineTotal: expect.any(String) },
    ]);
    expect(Number(added.body.data.lines[0].price)).toBe(10);
    expect(Number(added.body.data.lines[0].lineTotal)).toBe(10);
    expect(Number(added.body.data.subtotal)).toBe(10);

    // GET reflects the same state without a re-POST — cart state can now survive a page reload.
    const read = await request(app).get(`/store/v1/carts/${cartId}`);
    expect(read.status).toBe(200);
    expect(read.body.data.lines).toHaveLength(1);
    expect(Number(read.body.data.lines[0].lineTotal)).toBe(10);

    // Re-POST with a new qty overwrites (upsert), not a second line.
    const updated = await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 5 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.lines).toHaveLength(1);
    expect(updated.body.data.lines[0].qty).toBe(5);
    expect(Number(updated.body.data.lines[0].lineTotal)).toBe(50);
    expect(Number(updated.body.data.subtotal)).toBe(50);

    // DELETE removes the line entirely.
    const removed = await request(app).delete(`/store/v1/carts/${cartId}/lines/${variantId}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.lines).toEqual([]);
    expect(removed.body.data.subtotal).toBeNull();

    const readAfterRemove = await request(app).get(`/store/v1/carts/${cartId}`);
    expect(readAfterRemove.body.data.lines).toEqual([]);
  });

  it('lists shipping methods for a currency (plan/14 Phase 7a — checkout needs real options, not a blind code)', async () => {
    const res = await request(app).get('/store/v1/shipping-methods').query({ currency: 'USD' });
    expect(res.status).toBe(200);
    const standard = res.body.data.find((m: { code: string }) => m.code === 'STANDARD');
    expect(standard).toMatchObject({ name: 'Standard Shipping', currency: 'USD' });
    expect(Number(standard.flatRate)).toBe(5);
  });

  it('404s reading a non-existent cart', async () => {
    const res = await request(app).get('/store/v1/carts/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b');
    expect(res.status).toBe(404);
  });

  it('404s removing a line from a non-existent cart', async () => {
    const variantId = await createVariant('ORD-SKU-CART-404', '10.00');
    const res = await request(app).delete(`/store/v1/carts/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b/lines/${variantId}`);
    expect(res.status).toBe(404);
  });

  it('404s removing a non-existent variant from a real cart', async () => {
    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    const res = await request(app).delete(`/store/v1/carts/${cart.body.data.publicId}/lines/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b`);
    expect(res.status).toBe(404);
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

  it('lists orders with the plan/15 filters: fulfillmentStatus, orderId, customerName, date range, sort', async () => {
    const byFulfillment = await admin.get('/admin/v1/orders').query({ fulfillmentStatus: 'FULFILLED' });
    expect(byFulfillment.status).toBe(200);
    expect(byFulfillment.body.data.orders.length).toBeGreaterThanOrEqual(1);
    expect(byFulfillment.body.data.orders.every((o: { fulfillmentStatus: string }) => o.fulfillmentStatus === 'FULFILLED')).toBe(true);

    const first = byFulfillment.body.data.orders[0];
    const byOrderId = await admin.get('/admin/v1/orders').query({ orderId: first.orderNumber });
    expect(byOrderId.body.data.orders.some((o: { orderNumber: string }) => o.orderNumber === first.orderNumber)).toBe(true);

    const byCustomerName = await admin.get('/admin/v1/orders').query({ customerName: 'Jane' });
    expect(byCustomerName.status).toBe(200);
    expect(byCustomerName.body.data.orders.length).toBeGreaterThanOrEqual(1);
    expect(byCustomerName.body.data.orders[0]).toHaveProperty('customerName');
    expect(byCustomerName.body.data.orders[0]).toHaveProperty('paymentMethod');

    const today = new Date().toISOString().slice(0, 10);
    const byDate = await admin.get('/admin/v1/orders').query({ dateFrom: today, dateTo: today });
    expect(byDate.status).toBe(200);
    expect(byDate.body.data.orders.length).toBeGreaterThanOrEqual(1);

    const farFuture = await admin.get('/admin/v1/orders').query({ dateFrom: '2099-01-01' });
    expect(farFuture.body.data.orders).toEqual([]);

    const sorted = await admin.get('/admin/v1/orders').query({ sortBy: 'grandTotal', sortDir: 'asc', pageSize: 100 });
    expect(sorted.status).toBe(200);
    const totals = sorted.body.data.orders.map((o: { grandTotal: string }) => Number(o.grandTotal));
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  it('records order history on create/pay, fulfill, and cancel; exposes it via GET .../history', async () => {
    const variantId = await createVariant('ORD-SKU-HISTORY-1', '12.00');
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
    const orderPublicId = checkout.body.data.publicId;

    const afterCreate = await admin.get(`/admin/v1/orders/${orderPublicId}/history`);
    expect(afterCreate.status).toBe(200);
    const eventTypes = afterCreate.body.data.map((h: { eventType: string }) => h.eventType);
    expect(eventTypes).toContain('ORDER_CREATED');
    expect(eventTypes).toContain('PAYMENT_RECEIVED');

    await admin
      .post(`/admin/v1/orders/${orderPublicId}/fulfillments`)
      .send({ lines: [{ sku: 'ORD-SKU-HISTORY-1', qty: 1 }], trackingNumber: 'TRACK-123', carrier: 'UPS' });

    const afterFulfill = await admin.get(`/admin/v1/orders/${orderPublicId}/history`);
    expect(afterFulfill.body.data.map((h: { eventType: string }) => h.eventType)).toContain('SHIPMENT_CREATED');

    const detail = await admin.get(`/admin/v1/orders/${orderPublicId}`);
    expect(detail.body.data.fulfillments).toHaveLength(1);
    expect(detail.body.data.fulfillments[0].trackingNumber).toBe('TRACK-123');
    expect(detail.body.data.fulfillments[0].carrier).toBe('UPS');

    const cancel = await admin.post(`/admin/v1/orders/${orderPublicId}/cancel`).send({ reason: 'customer request' });
    expect(cancel.status).toBe(409); // already fulfilled -> CancelOrder blocks cancellation once any line is fulfilled
  });

  it('adds an order note and records it in history', async () => {
    const variantId = await createVariant('ORD-SKU-NOTE-1', '10.00');
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
    const orderPublicId = checkout.body.data.publicId;

    const note = await admin.post(`/admin/v1/orders/${orderPublicId}/notes`).send({ type: 'INTERNAL', body: 'Called customer to confirm address.' });
    expect(note.status).toBe(201);
    expect(note.body.data.type).toBe('INTERNAL');
    expect(note.body.data.body).toBe('Called customer to confirm address.');

    const detail = await admin.get(`/admin/v1/orders/${orderPublicId}`);
    expect(detail.body.data.notes).toHaveLength(1);
    expect(detail.body.data.notes[0].body).toBe('Called customer to confirm address.');

    const history = await admin.get(`/admin/v1/orders/${orderPublicId}/history`);
    expect(history.body.data.map((h: { eventType: string }) => h.eventType)).toContain('NOTE_ADDED');
  });

  it('sets financialStatus=FAILED (not left at PENDING) when a checkout payment is declined', async () => {
    const variantId = await createVariant('ORD-SKU-DECLINE-STATUS-1', '10.00');
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
        testScenario: 'decline',
      });
    expect(checkout.status).toBe(402);

    const orderRow = await prisma.order.findFirstOrThrow({ where: { lines: { some: { sku: 'ORD-SKU-DECLINE-STATUS-1' } } } });
    expect(orderRow.financialStatus).toBe('FAILED');
    expect(orderRow.status).toBe('CANCELLED');
  });

  it('cancels an order with refundTo=WALLET: credits the customer wallet instead of the original payment method', async () => {
    const variantId = await createVariant('ORD-SKU-WALLET-REFUND-1', '18.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 5, reason: 'PURCHASE' });

    await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'us_retail', email: 'wallet-refund-customer@example.com', password: 'correct-horse-battery' });
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'wallet-refund-customer@example.com', password: 'correct-horse-battery' });
    const customerPublicId = login.body.data.customerPublicId as string;
    const customerToken = login.body.data.token as string;

    const cart = await request(app).post('/store/v1/carts').send({ storeViewId, customerPublicId });
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });
    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'wallet-refund-customer@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'STANDARD',
        paymentMethod: 'test_card',
      });
    expect(checkout.status).toBe(201);
    const orderPublicId = checkout.body.data.publicId;

    const cancel = await admin.post(`/admin/v1/orders/${orderPublicId}/cancel`).send({ reason: 'changed mind', refundTo: 'WALLET' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('CANCELLED');
    expect(cancel.body.data.financialStatus).toBe('REFUNDED');

    const wallet = await request(app).get('/store/v1/me/wallet').set('Authorization', `Bearer ${customerToken}`);
    expect(wallet.status).toBe(200);
    // RefundOrder only refunds line items (unit price * qty + proportional tax), not shipping.
    expect(wallet.body.data.balance).toBe('18.0000');
  });

  it('rejects refundTo=WALLET for a guest order (no customer to credit)', async () => {
    const variantId = await createVariant('ORD-SKU-WALLET-GUEST-1', '10.00');
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
    const orderPublicId = checkout.body.data.publicId;

    const cancel = await admin.post(`/admin/v1/orders/${orderPublicId}/cancel`).send({ refundTo: 'WALLET' });
    expect(cancel.status).toBe(422);
  });

  it('gates GET /orders, GET /orders/:id, and POST .../fulfillments behind admin auth (401 without a token)', async () => {
    const list = await request(app).get('/admin/v1/orders');
    expect(list.status).toBe(401);
    const detail = await request(app).get('/admin/v1/orders/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b');
    expect(detail.status).toBe(401);
    const fulfill = await request(app).post('/admin/v1/orders/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b/fulfillments').send({ lines: [] });
    expect(fulfill.status).toBe(401);
  });

  it('creates an invoice for a paid order (all lines, default), renders a real PDF, and records history', async () => {
    const variantId = await createVariant('ORD-SKU-INVOICE-1', '22.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 5, reason: 'PURCHASE' });
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
    expect(checkout.status).toBe(201);
    const orderPublicId = checkout.body.data.publicId;

    const invoice = await admin.post(`/admin/v1/orders/${orderPublicId}/invoice`).send({});
    expect(invoice.status).toBe(201);
    expect(invoice.body.data.invoices).toHaveLength(1);
    const inv = invoice.body.data.invoices[0];
    expect(inv.invoiceNumber).toBeTruthy();
    expect(inv.status).toBe('ISSUED');
    expect(inv.subtotal).toBe('66.0000'); // 22.00 * 3
    expect(inv.grandTotal).toBe('66.0000'); // no tax class assigned
    expect(inv.lines).toEqual([
      expect.objectContaining({ sku: 'ORD-SKU-INVOICE-1', qty: 3, rowTotal: '66.0000' }),
    ]);

    const history = await admin.get(`/admin/v1/orders/${orderPublicId}/history`);
    expect(history.body.data.map((h: { eventType: string }) => h.eventType)).toContain('INVOICE_CREATED');

    const list = await admin.get(`/admin/v1/orders/${orderPublicId}/invoices`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].publicId).toBe(inv.publicId);

    const detail = await admin.get(`/admin/v1/orders/${orderPublicId}/invoice/${inv.publicId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.invoiceNumber).toBe(inv.invoiceNumber);

    // PDF was actually rendered and stored — follow the redirect and confirm real PDF bytes.
    const pdfRedirect = await admin.get(`/admin/v1/orders/${orderPublicId}/invoice/${inv.publicId}/pdf`).redirects(0);
    expect(pdfRedirect.status).toBe(302);
    const pdfUrl = pdfRedirect.headers.location as string;
    expect(pdfUrl).toContain('.pdf');
    const pdfBytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
    expect(pdfBytes.byteLength).toBeGreaterThan(100);
    expect(Buffer.from(pdfBytes.slice(0, 5)).toString('utf8')).toBe('%PDF-');

    const regenerate = await admin.post(`/admin/v1/orders/${orderPublicId}/invoice/${inv.publicId}/regenerate`);
    expect(regenerate.status).toBe(200);
    expect(regenerate.body.data.invoices).toHaveLength(1);
  });

  it('supports partial invoicing across two calls, then rejects over-invoicing the remainder', async () => {
    const variantId = await createVariant('ORD-SKU-INVOICE-PARTIAL-1', '10.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 10, reason: 'PURCHASE' });
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
    const orderPublicId = checkout.body.data.publicId;

    const first = await admin
      .post(`/admin/v1/orders/${orderPublicId}/invoice`)
      .send({ lines: [{ sku: 'ORD-SKU-INVOICE-PARTIAL-1', qty: 2 }] });
    expect(first.status).toBe(201);
    expect(first.body.data.invoices).toHaveLength(1);
    expect(first.body.data.invoices[0].lines[0].qty).toBe(2);

    const overInvoice = await admin
      .post(`/admin/v1/orders/${orderPublicId}/invoice`)
      .send({ lines: [{ sku: 'ORD-SKU-INVOICE-PARTIAL-1', qty: 4 }] }); // only 3 remain
    expect(overInvoice.status).toBe(409);

    const second = await admin
      .post(`/admin/v1/orders/${orderPublicId}/invoice`)
      .send({ lines: [{ sku: 'ORD-SKU-INVOICE-PARTIAL-1', qty: 3 }] });
    expect(second.status).toBe(201);
    expect(second.body.data.invoices).toHaveLength(2);

    const fullyInvoiced = await admin.post(`/admin/v1/orders/${orderPublicId}/invoice`).send({});
    expect(fullyInvoiced.status).toBe(409); // nothing left to default-invoice
  });

  it('rejects invoicing an order that was never paid', async () => {
    const variantId = await createVariant('ORD-SKU-INVOICE-UNPAID-1', '10.00');
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
        testScenario: 'decline',
      });
    expect(checkout.status).toBe(402);
    const orderRow = await prisma.order.findFirstOrThrow({ where: { lines: { some: { sku: 'ORD-SKU-INVOICE-UNPAID-1' } } } });
    const orderPublicId = orderRow.publicId;

    const invoice = await admin.post(`/admin/v1/orders/${orderPublicId}/invoice`).send({});
    expect(invoice.status).toBe(409);
  });

  it('fulfills with carrier tracking details, generates a packing slip PDF, and exposes both via GET', async () => {
    const variantId = await createVariant('ORD-SKU-TRACKING-1', '14.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'ORD-WH', delta: 5, reason: 'PURCHASE' });
    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 2 });
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

    const fulfill = await admin.post(`/admin/v1/orders/${orderPublicId}/fulfillments`).send({
      lines: [{ sku: 'ORD-SKU-TRACKING-1', qty: 2 }],
      trackingNumber: 'TRACK-999',
      carrier: 'FedEx',
      carrierTrackingUrl: 'https://fedex.example.com/track/TRACK-999',
      estimatedDeliveryAt: '2026-08-01',
      shippingNotes: 'Leave at front desk',
    });
    expect(fulfill.status).toBe(200);
    const f = fulfill.body.data.fulfillments[0];
    expect(f.carrierTrackingUrl).toBe('https://fedex.example.com/track/TRACK-999');
    expect(f.estimatedDeliveryAt).toContain('2026-08-01');
    expect(f.shippingNotes).toBe('Leave at front desk');
    expect(f.hasPackingSlip).toBe(true);

    const detail = await admin.get(`/admin/v1/orders/${orderPublicId}`);
    expect(detail.body.data.fulfillments[0].hasPackingSlip).toBe(true);

    const packingSlipRedirect = await admin
      .get(`/admin/v1/orders/${orderPublicId}/shipment/${f.publicId}/packing-slip`)
      .redirects(0);
    expect(packingSlipRedirect.status).toBe(302);
    const pdfUrl = packingSlipRedirect.headers.location as string;
    const pdfBytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
    expect(pdfBytes.byteLength).toBeGreaterThan(100);
    expect(Buffer.from(pdfBytes.slice(0, 5)).toString('utf8')).toBe('%PDF-');
  });

  it('fulfilling without tracking details still creates a (mostly-null) shipment_tracking row and a packing slip', async () => {
    const variantId = await createVariant('ORD-SKU-TRACKING-BARE-1', '9.00');
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
    const orderPublicId = checkout.body.data.publicId;

    const fulfill = await admin.post(`/admin/v1/orders/${orderPublicId}/fulfillments`).send({ lines: [{ sku: 'ORD-SKU-TRACKING-BARE-1', qty: 1 }] });
    expect(fulfill.status).toBe(200);
    const f = fulfill.body.data.fulfillments[0];
    expect(f.carrierTrackingUrl).toBeNull();
    expect(f.estimatedDeliveryAt).toBeNull();
    expect(f.shippingNotes).toBeNull();
    expect(f.hasPackingSlip).toBe(true);
  });
});
