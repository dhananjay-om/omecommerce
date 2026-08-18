import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';
import { ReleaseExpiredStoredValueHolds } from '../../src/modules/order/application/release-expired-stored-value-holds.usecase.js';
import { PrismaWalletLedger } from '../../src/modules/wallet/infrastructure/prisma-wallet-ledger.js';
import { PrismaGiftCardLedger } from '../../src/modules/giftcard/infrastructure/prisma-giftcard-ledger.js';

/**
 * Checkout tender (plan/15 Phase 5, live DB): paying an order with wallet/
 * gift-card stored value via real two-phase holds — gift-card-partial and
 * wallet-full (zero PSP call) checkouts, a declined-PSP release path, a
 * 10-concurrent-checkouts-against-one-wallet race-safety proof (same shape
 * as wallet-api.test.ts's own concurrent-debit test), expired-hold sweep,
 * and split-tender refund routing. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('checkout tender (live DB)', () => {
  const app = createApp();
  let attributeSetId = '';
  let storeViewId = '';
  let admin: ReturnType<typeof adminRequest>;

  const address = { name: 'Jane Doe', line1: '123 Main St', city: 'Springfield', postalCode: '12345', country: 'US' };

  async function createVariant(sku: string, price: string): Promise<string> {
    const created = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku, attributeSetId, status: 'ACTIVE' });
    expect(created.status).toBe(201);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    await admin.post('/admin/v1/price-lists').send({ code: `PL-${sku}`, name: sku, currency: 'USD', priority: 0 });
    await admin.put(`/admin/v1/price-lists/PL-${sku}/prices`).send({ variantId: variant.publicId, price });
    return variant.publicId;
  }

  async function stockUp(variantId: string, qty: number): Promise<void> {
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'TND-WH', delta: qty, reason: 'PURCHASE' });
  }

  async function registerCustomer(email: string): Promise<{ customerPublicId: string; token: string }> {
    const reg = await request(app).post('/store/v1/customers').send({ websiteCode: 'us_retail', email, password: 'a-fine-password-1' });
    const login = await request(app).post('/store/v1/customers/actions/login').send({ websiteCode: 'us_retail', email, password: 'a-fine-password-1' });
    return { customerPublicId: reg.body.data.publicId, token: login.body.data.token };
  }

  async function issueGiftCard(amount: string): Promise<{ code: string; publicId: string }> {
    const res = await admin.post('/admin/v1/gift-cards').send({ websiteCode: 'us_retail', amount });
    expect(res.status).toBe(201);
    return { code: res.body.data.code, publicId: res.body.data.publicId };
  }

  async function creditWallet(customerPublicId: string, amount: string): Promise<void> {
    const res = await admin
      .post(`/admin/v1/customers/${customerPublicId}/wallet/actions/credit`)
      .send({ amount, bucket: 'STORE_CREDIT', source: 'GOODWILL' });
    expect(res.status).toBe(200);
  }

  async function createCartWithLine(variantId: string, qty: number, customerPublicId?: string): Promise<string> {
    const cart = await request(app).post('/store/v1/carts').send({ storeViewId, customerPublicId });
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty });
    return cartId;
  }

  function checkoutBody(overrides: Record<string, unknown> = {}) {
    return {
      email: 'jane@example.com',
      billingAddress: address,
      shippingAddress: address,
      shippingMethodCode: 'STANDARD',
      paymentMethod: 'test_card',
      testScenario: 'approve',
      ...overrides,
    };
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE stored_value_hold, cart_tender, wallet_transaction, wallet, gift_card_transaction, gift_card,
       order_return_line, order_return, fulfillment_line, fulfillment, payment_transaction,
       order_tax_line, order_address, order_line, "order", cart_line, cart,
       tax_class, shipping_method, price_tier, product_price, price_list,
       stock_reservation, stock_movement, stock_item, product,
       customer_address, customer RESTART IDENTITY CASCADE`,
    );
    const set = await prisma.attributeSet.upsert({
      where: { code: 'tender-test-set' },
      update: {},
      create: { code: 'tender-test-set', name: 'Tender Test Set' },
    });
    attributeSetId = set.id.toString();

    await prisma.currency.upsert({ where: { code: 'USD' }, update: {}, create: { code: 'USD', symbol: '$', minorUnits: 2, name: 'US Dollar' } });
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
    const lang = await prisma.language.upsert({ where: { code: 'en-US' }, update: {}, create: { code: 'en-US', name: 'English', nativeName: 'English' } });
    const sv = await prisma.storeView.upsert({
      where: { storeId_code: { storeId: store.id, code: 'en' } },
      update: {},
      create: { storeId: store.id, code: 'en', languageId: lang.id, currency: 'USD' },
    });
    storeViewId = sv.id.toString();

    admin = adminRequest(app, await getAdminToken(app));

    await admin.post('/admin/v1/warehouses').send({ code: 'TND-WH', name: 'Tender Warehouse' });
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: 'TND-WH' } });
    await prisma.storeWarehouse.deleteMany({ where: { storeId: store.id } });
    await prisma.storeWarehouse.create({ data: { storeId: store.id, warehouseId: warehouse.id, priority: 0 } });
    await admin.post('/admin/v1/shipping-methods').send({ code: 'STANDARD', name: 'Standard Shipping', flatRate: '5.00', currency: 'USD' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('gift-card-partial: covers part of the total, PSP charged for the rest', async () => {
    const variantId = await createVariant('TND-GC-PARTIAL', '30.00');
    await stockUp(variantId, 5);
    const giftCard = await issueGiftCard('10.00');

    const cartId = await createCartWithLine(variantId, 1);
    const applied = await request(app).post(`/store/v1/carts/${cartId}/actions/apply-gift-card`).send({ code: giftCard.code });
    expect(applied.status).toBe(200);
    expect(applied.body.data.tenders).toHaveLength(1);
    expect(applied.body.data.tenders[0]).toMatchObject({ tenderType: 'GIFT_CARD', giftCardLast4: expect.any(String) });
    // Cart-level amountDue is computed pre-shipping (like estimatedTotal — shipping is
    // only known at checkout): subtotal 30.00, gift card covers 10.00 of it.
    expect(applied.body.data.amountDue).toBe('20.0000');

    const checkout = await request(app).post(`/store/v1/carts/${cartId}/checkout`).send(checkoutBody());
    expect(checkout.status).toBe(201);
    expect(checkout.body.data.financialStatus).toBe('PAID');

    const gcAfter = await admin.get(`/admin/v1/gift-cards/${giftCard.publicId}`);
    expect(gcAfter.body.data.balance).toBe('0.0000');

    const payments = await admin.get(`/admin/v1/orders/${checkout.body.data.publicId}`);
    const methods = payments.body.data.payments.map((p: { method: string; amount: string; status: string }) => ({ method: p.method, amount: p.amount, status: p.status }));
    expect(methods).toContainEqual({ method: 'giftcard', amount: '10.0000', status: 'SUCCEEDED' });
    expect(methods).toContainEqual({ method: 'test_card', amount: '25.0000', status: 'SUCCEEDED' });
  });

  it('wallet-full: fully covers the total, zero PSP calls, no paymentMethod required', async () => {
    const variantId = await createVariant('TND-WALLET-FULL', '20.00');
    await stockUp(variantId, 5);
    const { customerPublicId, token } = await registerCustomer('wallet-full@example.com');
    await creditWallet(customerPublicId, '100.00');

    const cartId = await createCartWithLine(variantId, 1, customerPublicId);
    const applied = await request(app).post(`/store/v1/carts/${cartId}/actions/apply-wallet`).set('Authorization', `Bearer ${token}`).send();
    expect(applied.status).toBe(200);
    // grandTotal = 20.00 + 5.00 shipping = 25.00, wallet has 100 available -> fully covers it.
    expect(applied.body.data.amountDue).toBe('0.0000');

    // No paymentMethod at all — CompleteCheckout must not require it when nothing is due.
    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({ email: 'jane@example.com', billingAddress: address, shippingAddress: address, shippingMethodCode: 'STANDARD' });
    expect(checkout.status).toBe(201);
    expect(checkout.body.data.financialStatus).toBe('PAID');

    const payments = await admin.get(`/admin/v1/orders/${checkout.body.data.publicId}`);
    const methods = payments.body.data.payments.map((p: { method: string }) => p.method);
    expect(methods).toEqual(['wallet']); // no PSP row at all

    const wallet = await request(app).get('/store/v1/me/wallet').set('Authorization', `Bearer ${token}`);
    expect(wallet.body.data.balance).toBe('75.0000');
  });

  it('declined PSP: every hold (inventory + stored-value) releases symmetrically, balances restored', async () => {
    const variantId = await createVariant('TND-DECLINE', '40.00');
    await stockUp(variantId, 5);
    const giftCard = await issueGiftCard('10.00');

    const cartId = await createCartWithLine(variantId, 1);
    await request(app).post(`/store/v1/carts/${cartId}/actions/apply-gift-card`).send({ code: giftCard.code });

    const checkout = await request(app).post(`/store/v1/carts/${cartId}/checkout`).send(checkoutBody({ testScenario: 'decline' }));
    expect(checkout.status).toBe(402);

    // Gift card hold released: balance untouched, heldBalance back to 0.
    const gcAfter = await admin.get(`/admin/v1/gift-cards/${giftCard.publicId}`);
    expect(gcAfter.body.data.balance).toBe('10.0000');

    // Scoped to THIS test's own gift card — other tests in this file share
    // the same DB (only a beforeAll truncate, not per-test), so querying
    // "every gift-card hold ever" would pick up earlier tests' CAPTURED ones.
    const holds = await prisma.storedValueHold.findMany({ where: { giftCard: { publicId: giftCard.publicId } } });
    expect(holds.length).toBeGreaterThan(0);
    expect(holds.every((h) => h.status === 'RELEASED')).toBe(true);

    // stock: reservation released too, same as the existing non-tender decline test.
    const stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'TND-WH' });
    expect(stock.body.data.reserved).toBe(0);
  });

  it('10 concurrent checkouts against one wallet never over-allocate it', async () => {
    const { customerPublicId } = await registerCustomer('wallet-race@example.com');
    await creditWallet(customerPublicId, '50.00');

    const variantId = await createVariant('TND-RACE', '10.00');
    await stockUp(variantId, 20);

    // 10 separate $10 orders (+ $5 shipping = $15 each, $150 total demand)
    // against a $50 wallet — each applies the wallet tender, then checks out
    // with a valid PSP fallback so a partially-covered order still succeeds.
    const cartIds = await Promise.all(Array.from({ length: 10 }, () => createCartWithLine(variantId, 1, customerPublicId)));
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'wallet-race@example.com', password: 'a-fine-password-1' });
    const customerToken = login.body.data.token as string;

    await Promise.all(cartIds.map((cartId) => request(app).post(`/store/v1/carts/${cartId}/actions/apply-wallet`).set('Authorization', `Bearer ${customerToken}`).send()));

    const results = await Promise.all(cartIds.map((cartId) => request(app).post(`/store/v1/carts/${cartId}/checkout`).send(checkoutBody())));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(results.every((r) => r.body.data.financialStatus === 'PAID')).toBe(true);

    const wallet = await request(app).get('/store/v1/me/wallet').set('Authorization', `Bearer ${customerToken}`);
    // Exactly $50 got captured via wallet across all 10 orders — never more.
    expect(wallet.body.data.balance).toBe('0.0000');

    for (const r of results) {
      const order = await admin.get(`/admin/v1/orders/${r.body.data.publicId}`);
      const walletPayment = order.body.data.payments.find((p: { method: string }) => p.method === 'wallet');
      const pspPayment = order.body.data.payments.find((p: { method: string }) => p.method === 'test_card');
      // Every order was funded by SOME combination of wallet + PSP summing to its $15 total.
      const walletAmount = walletPayment ? Number(walletPayment.amount) : 0;
      const pspAmount = pspPayment ? Number(pspPayment.amount) : 0;
      expect(walletAmount + pspAmount).toBeCloseTo(15, 4);
    }
  });

  it('expired holds are swept: status -> EXPIRED, heldBalance released', async () => {
    const giftCard = await issueGiftCard('20.00');
    const gcRow = await prisma.giftCard.findFirstOrThrow({ where: { publicId: giftCard.publicId } });

    // Manually place an already-expired HELD hold, bypassing the API (the
    // real hold() call always uses a future TTL) — same "seed the DB
    // directly to exercise the sweep" approach as inventory's own expiry test.
    await prisma.$executeRaw`
      UPDATE gift_card SET held_balance = held_balance + 5.00 WHERE id = ${gcRow.id}`;
    await prisma.storedValueHold.create({
      data: {
        tenderType: 'GIFT_CARD',
        giftCardId: gcRow.id,
        amount: '5.00',
        currency: 'USD',
        refType: 'CART',
        refId: 999999n,
        status: 'HELD',
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const beforeSweep = await admin.get(`/admin/v1/gift-cards/${giftCard.publicId}`);
    expect(beforeSweep.body.data.balance).toBe('20.0000'); // unaffected — a hold never touches balance

    const sweep = new ReleaseExpiredStoredValueHolds(new PrismaWalletLedger(prisma), new PrismaGiftCardLedger(prisma));
    const result = await sweep.execute();
    expect(result.releasedCount).toBeGreaterThanOrEqual(1);

    const hold = await prisma.storedValueHold.findFirstOrThrow({ where: { giftCardId: gcRow.id, refId: 999999n } });
    expect(hold.status).toBe('EXPIRED');
    const gcAfter = await prisma.giftCard.findFirstOrThrow({ where: { id: gcRow.id } });
    // Prisma's Decimal.toString() strips trailing zeros ("0.0000" -> "0") —
    // compare numerically, same reasoning documented on formatDecimal() in
    // the ledger infrastructure files.
    expect(Number(gcAfter.heldBalance)).toBe(0);
  });

  it('split-tender refund: proportionally credits the gift card and refunds the PSP portion', async () => {
    const variantId = await createVariant('TND-REFUND', '30.00');
    await stockUp(variantId, 5);
    const giftCard = await issueGiftCard('10.00');

    const cartId = await createCartWithLine(variantId, 1);
    await request(app).post(`/store/v1/carts/${cartId}/actions/apply-gift-card`).send({ code: giftCard.code });
    // grandTotal = 30 + 5 shipping = 35; gift card covers 10, PSP covers 25.
    const checkout = await request(app).post(`/store/v1/carts/${cartId}/checkout`).send(checkoutBody());
    expect(checkout.status).toBe(201);
    const orderPublicId = checkout.body.data.publicId;

    // Full refund (restock, default refundTo — proportional split). Refunds
    // in this codebase only ever refund subtotal+tax-discount per line, not
    // shipping (pre-existing behavior, unchanged by Phase 5) — so
    // refundTotalMinor here is 30.00, not the order's 35.00 grandTotal.
    const refund = await admin.post(`/admin/v1/orders/${orderPublicId}/refunds`).send({ lines: [{ sku: 'TND-REFUND', qty: 1 }] });
    expect(refund.status).toBe(200);
    expect(refund.body.data.financialStatus).toBe('REFUNDED');

    // Gift card credited back its proportional share: 30.00 * (10.00 / 35.00) = 8.5714 (floored).
    const gcAfter = await admin.get(`/admin/v1/gift-cards/${giftCard.publicId}`);
    expect(gcAfter.body.data.balance).toBe('8.5714');

    const order = await admin.get(`/admin/v1/orders/${orderPublicId}`);
    const refundRows = order.body.data.payments.filter((p: { type: string }) => p.type === 'REFUND');
    const giftCardRefund = refundRows.find((p: { method: string }) => p.method === 'giftcard');
    const pspRefund = refundRows.find((p: { method: string }) => p.method === 'original');
    expect(giftCardRefund.amount).toBe('8.5714');
    // The PSP share absorbs the rounding remainder: 30.00 - 8.5714 = 21.4286.
    expect(pspRefund.amount).toBe('21.4286');
  });
});
