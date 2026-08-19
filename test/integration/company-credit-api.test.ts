import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * B2B Net-X credit terms — "pay on account" tender + AR settlement (plan/15
 * Phase 7, live DB). Proves the credit line is a Wallet-mirror ledger (guarded
 * UPDATE against the credit limit, race-safe under concurrency), that an
 * on-account order's financial status is ON_ACCOUNT (not PAID) until the
 * merchant records a payment against it, and that split/cancel/aging all
 * behave as designed.
 *
 * Loyalty/referral earning itself (worker chain off the OrderPaid outbox
 * event) is already proven end-to-end by loyalty-api.test.ts and
 * referral-api.test.ts — this suite's job is proving CREDIT_TERMS' own
 * contribution to that chain: that OrderPaid is deliberately NOT written
 * while an order is ON_ACCOUNT, and IS written the moment RecordCompanyCredit
 * Payment settles it. Checking the outbox_event row directly (rather than
 * standing up the whole loyalty worker) is the most direct proof of that
 * specific mechanism. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('B2B credit terms (live DB)', () => {
  const app = createApp();
  let attributeSetId = '';
  let storeViewId = '';
  let admin: ReturnType<typeof adminRequest>;

  const address = {
    name: 'Jane Buyer',
    line1: '1 Business Rd',
    city: 'Metropolis',
    postalCode: '10001',
    country: 'US',
  };

  async function createVariant(sku: string, price: string): Promise<string> {
    const created = await admin
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku, attributeSetId, status: 'ACTIVE' });
    expect(created.status).toBe(201);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    await admin
      .post('/admin/v1/price-lists')
      .send({ code: `PL-${sku}`, name: sku, currency: 'USD', priority: 0 });
    await admin
      .put(`/admin/v1/price-lists/PL-${sku}/prices`)
      .send({ variantId: variant.publicId, price });
    return variant.publicId;
  }

  async function stockUp(variantId: string, qty: number): Promise<void> {
    await admin
      .post('/admin/v1/inventory/adjustments')
      .send({ variantId, warehouseCode: 'CR-WH', delta: qty, reason: 'PURCHASE' });
  }

  async function registerAndLogin(
    email: string,
  ): Promise<{ customerPublicId: string; token: string }> {
    const reg = await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'cr_retail', email, password: 'correct-horse-battery' });
    expect(reg.status).toBe(201);
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'cr_retail', email, password: 'correct-horse-battery' });
    expect(login.status).toBe(200);
    return {
      customerPublicId: reg.body.data.publicId as string,
      token: login.body.data.token as string,
    };
  }

  /** Company created, activated, and given a credit line, plus one member customer already added to it. */
  async function setupCompanyWithCredit(
    code: string,
    creditLimit: string,
    email: string,
    termsType = 'NET_30',
  ): Promise<{ companyPublicId: string; customerPublicId: string; token: string }> {
    const company = await admin
      .post('/admin/v1/companies')
      .send({ websiteCode: 'cr_retail', code, name: `${code} Inc` });
    expect(company.status).toBe(201);
    const companyPublicId = company.body.data.publicId as string;
    await admin
      .post(`/admin/v1/companies/${companyPublicId}/actions/set-status`)
      .send({ status: 'ACTIVE' });
    const setCredit = await admin
      .put(`/admin/v1/companies/${companyPublicId}/credit`)
      .send({ creditLimit, termsType });
    expect(setCredit.status).toBe(200);
    const member = await registerAndLogin(email);
    await admin.post(`/admin/v1/companies/${companyPublicId}/members`).send({ email });
    return { companyPublicId, ...member };
  }

  async function createCartWithLine(
    variantId: string,
    qty: number,
    customerPublicId: string,
  ): Promise<string> {
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
      shippingMethodCode: 'CR-STANDARD',
      paymentMethod: 'test_card',
      testScenario: 'approve',
      ...overrides,
    };
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE company_credit_transaction, company_credit_account, company_customer, company,
       stored_value_hold, cart_tender, wallet_transaction, wallet, gift_card_transaction, gift_card,
       order_return_line, order_return, fulfillment_line, fulfillment, payment_transaction,
       order_tax_line, order_address, order_line, "order", cart_line, cart,
       tax_class, shipping_method, price_tier, product_price, price_list,
       stock_reservation, stock_movement, stock_item, product,
       customer_address, customer, outbox_event RESTART IDENTITY CASCADE`,
    );
    const set = await prisma.attributeSet.upsert({
      where: { code: 'cr-test-set' },
      update: {},
      create: { code: 'cr-test-set', name: 'Credit Test Set' },
    });
    attributeSetId = set.id.toString();

    await prisma.currency.upsert({
      where: { code: 'USD' },
      update: {},
      create: { code: 'USD', symbol: '$', minorUnits: 2, name: 'US Dollar' },
    });
    const website = await prisma.website.upsert({
      where: { code: 'cr_retail' },
      update: {},
      create: { code: 'cr_retail', name: 'Credit Retail', baseCurrency: 'USD', isDefault: false },
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

    await admin.post('/admin/v1/warehouses').send({ code: 'CR-WH', name: 'Credit Warehouse' });
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: 'CR-WH' } });
    await prisma.storeWarehouse.deleteMany({ where: { storeId: store.id } });
    await prisma.storeWarehouse.create({
      data: { storeId: store.id, warehouseId: warehouse.id, priority: 0 },
    });
    await admin
      .post('/admin/v1/shipping-methods')
      .send({ code: 'CR-STANDARD', name: 'Standard Shipping', flatRate: '5.00', currency: 'USD' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('sets up a credit account (creates on first PUT), defaulting currency to the website base currency', async () => {
    const company = await admin
      .post('/admin/v1/companies')
      .send({ websiteCode: 'cr_retail', code: 'CR-SETUP', name: 'Setup Co' });
    const publicId = company.body.data.publicId;

    const before = await admin.get(`/admin/v1/companies/${publicId}/credit`);
    expect(before.body.data).toBeNull();

    const res = await admin
      .put(`/admin/v1/companies/${publicId}/credit`)
      .send({ creditLimit: '1000.00', termsType: 'NET_45' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      creditLimit: '1000.0000',
      outstanding: '0.0000',
      available: '1000.0000',
      currency: 'USD',
      termsType: 'NET_45',
      status: 'ACTIVE',
    });
  });

  it('rejects lowering the credit limit below the current outstanding balance with a friendly 422', async () => {
    const { companyPublicId, customerPublicId, token } = await setupCompanyWithCredit(
      'CR-LOWER',
      '200.00',
      'lower@example.com',
    );
    const variantId = await createVariant('CR-LOWER-SKU', '50.00');
    await stockUp(variantId, 5);
    const cartId = await createCartWithLine(variantId, 1, customerPublicId);
    await request(app)
      .post(`/store/v1/carts/${cartId}/actions/apply-credit-terms`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    const checkout = await request(app).post(`/store/v1/carts/${cartId}/checkout`).send({
      email: 'lower@example.com',
      billingAddress: address,
      shippingAddress: address,
      shippingMethodCode: 'CR-STANDARD',
    });
    expect(checkout.status).toBe(201); // outstanding is now 55.00 (50 + 5 shipping)

    const rejected = await admin
      .put(`/admin/v1/companies/${companyPublicId}/credit`)
      .send({ creditLimit: '50.00' });
    expect(rejected.status).toBe(422);

    // Unchanged.
    const credit = await admin.get(`/admin/v1/companies/${companyPublicId}/credit`);
    expect(credit.body.data.creditLimit).toBe('200.0000');
  });

  it('an on-account order is ON_ACCOUNT (not PAID) and defers OrderPaid until the merchant records payment against it', async () => {
    const { companyPublicId, customerPublicId, token } = await setupCompanyWithCredit(
      'CR-ONACCT',
      '500.00',
      'onacct@example.com',
    );
    const variantId = await createVariant('CR-ONACCT-SKU', '100.00');
    await stockUp(variantId, 5);

    const cartId = await createCartWithLine(variantId, 1, customerPublicId);
    const applied = await request(app)
      .post(`/store/v1/carts/${cartId}/actions/apply-credit-terms`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(applied.status).toBe(200);
    expect(applied.body.data.tenders).toHaveLength(1);
    expect(applied.body.data.tenders[0]).toMatchObject({ tenderType: 'CREDIT_TERMS' });
    // grandTotal = 100 + 5 shipping = 105, fully covered by the $500 line.
    expect(applied.body.data.amountDue).toBe('0.0000');

    const checkout = await request(app).post(`/store/v1/carts/${cartId}/checkout`).send({
      email: 'onacct@example.com',
      billingAddress: address,
      shippingAddress: address,
      shippingMethodCode: 'CR-STANDARD',
      poNumber: 'PO-100',
    });
    expect(checkout.status).toBe(201);
    const order = checkout.body.data;
    expect(order.financialStatus).toBe('ON_ACCOUNT');
    expect(order.poNumber).toBe('PO-100');

    const paymentsRow = await admin.get(`/admin/v1/orders/${order.publicId}`);
    const methods = paymentsRow.body.data.payments.map((p: { method: string; amount: string }) => ({
      method: p.method,
      amount: p.amount,
    }));
    expect(methods).toContainEqual({ method: 'credit_terms', amount: '105.0000' });

    // Not yet settled — OrderPaid must not have been written.
    const beforeSettle = await prisma.outboxEvent.findMany({
      where: { aggregateType: 'Order', aggregateId: order.publicId, eventType: 'OrderPaid' },
    });
    expect(beforeSettle).toHaveLength(0);

    const creditBefore = await admin.get(`/admin/v1/companies/${companyPublicId}/credit`);
    expect(creditBefore.body.data.outstanding).toBe('105.0000');

    // Settle it.
    const settled = await admin
      .post(`/admin/v1/companies/${companyPublicId}/credit/actions/record-payment`)
      .send({
        amount: '105.00',
        orderPublicIds: [order.publicId],
        reason: 'Wire received',
      });
    expect(settled.status).toBe(200);
    expect(settled.body.data.outstanding).toBe('0.0000');

    const afterOrder = await admin.get(`/admin/v1/orders/${order.publicId}`);
    expect(afterOrder.body.data.financialStatus).toBe('PAID');

    // Settlement wrote the exact event CompleteCheckout's own PAID path would
    // have written immediately, just deferred.
    const afterSettle = await prisma.outboxEvent.findMany({
      where: { aggregateType: 'Order', aggregateId: order.publicId, eventType: 'OrderPaid' },
    });
    expect(afterSettle).toHaveLength(1);
  });

  it('rejects settling with an order publicId that is not an open on-account order for that company — nothing partially applies', async () => {
    const { companyPublicId, customerPublicId, token } = await setupCompanyWithCredit(
      'CR-BADSETTLE',
      '300.00',
      'badsettle@example.com',
    );
    const variantId = await createVariant('CR-BADSETTLE-SKU', '50.00');
    await stockUp(variantId, 5);
    const cartId = await createCartWithLine(variantId, 1, customerPublicId);
    await request(app)
      .post(`/store/v1/carts/${cartId}/actions/apply-credit-terms`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    const checkout = await request(app).post(`/store/v1/carts/${cartId}/checkout`).send({
      email: 'badsettle@example.com',
      billingAddress: address,
      shippingAddress: address,
      shippingMethodCode: 'CR-STANDARD',
    });
    expect(checkout.status).toBe(201);
    const orderPublicId = checkout.body.data.publicId as string;

    const bogus = '00000000-0000-7000-8000-000000000000';
    const rejected = await admin
      .post(`/admin/v1/companies/${companyPublicId}/credit/actions/record-payment`)
      .send({
        amount: '55.00',
        orderPublicIds: [orderPublicId, bogus],
      });
    expect(rejected.status).toBe(404);

    // Nothing applied — outstanding unchanged, still ON_ACCOUNT.
    const credit = await admin.get(`/admin/v1/companies/${companyPublicId}/credit`);
    expect(credit.body.data.outstanding).toBe('55.0000');
    const order = await admin.get(`/admin/v1/orders/${orderPublicId}`);
    expect(order.body.data.financialStatus).toBe('ON_ACCOUNT');
  });

  it('a checkout that exceeds available credit is capped, and a subsequent PSP decline unwinds BOTH the partial charge and the inventory hold', async () => {
    const { customerPublicId, token, companyPublicId } = await setupCompanyWithCredit(
      'CR-OVERLIMIT',
      '5.00',
      'overlimit@example.com',
    );
    const variantId = await createVariant('CR-OVERLIMIT-SKU', '40.00');
    await stockUp(variantId, 5);

    const cartId = await createCartWithLine(variantId, 1, customerPublicId);
    const applied = await request(app)
      .post(`/store/v1/carts/${cartId}/actions/apply-credit-terms`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    // amountDue is computed pre-shipping (like estimatedTotal — shipping is
    // only known at checkout): subtotal 40.00, only $5 of credit is
    // available, so amountDue reflects the capped application, not the full
    // subtotal.
    expect(applied.body.data.amountDue).toBe('35.0000');

    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send(checkoutBody({ testScenario: 'decline' }));
    expect(checkout.status).toBe(402);

    // The $5 credit charge placed during the tender-resolution step is
    // reversed by releaseAllHolds on the PSP decline — same symmetry as
    // wallet/gift-card holds, but via reverseCharge() since credit terms has
    // no two-phase hold.
    const credit = await admin.get(`/admin/v1/companies/${companyPublicId}/credit`);
    expect(credit.body.data.outstanding).toBe('0.0000');

    const stock = await admin
      .get('/admin/v1/inventory/stock')
      .query({ variantId, warehouseCode: 'CR-WH' });
    expect(stock.body.data.reserved).toBe(0);
  });

  it('10 concurrent on-account checkouts against one credit limit never over-allocate it', async () => {
    const { customerPublicId, token } = await setupCompanyWithCredit(
      'CR-RACE',
      '50.00',
      'race@example.com',
    );
    const variantId = await createVariant('CR-RACE-SKU', '10.00');
    await stockUp(variantId, 20);

    // 10 separate $10 orders (+ $5 shipping = $15 each, $150 total demand)
    // against a $50 credit line — each applies the credit-terms tender, then
    // checks out with a valid PSP fallback so a partially-covered order still
    // succeeds (same shape as checkout-tender.test.ts's wallet race proof).
    const cartIds = await Promise.all(
      Array.from({ length: 10 }, () => createCartWithLine(variantId, 1, customerPublicId)),
    );
    await Promise.all(
      cartIds.map((cartId) =>
        request(app)
          .post(`/store/v1/carts/${cartId}/actions/apply-credit-terms`)
          .set('Authorization', `Bearer ${token}`)
          .send(),
      ),
    );

    const results = await Promise.all(
      cartIds.map((cartId) =>
        request(app).post(`/store/v1/carts/${cartId}/checkout`).send(checkoutBody()),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    // Every order used SOME credit (even 0) plus PSP for the rest, so none of
    // them come back plain PAID-via-PSP-only... except the ones the credit
    // line had nothing left for. What must hold unconditionally is the cap.
    for (const r of results) {
      const order = await admin.get(`/admin/v1/orders/${r.body.data.publicId}`);
      const creditPayment = order.body.data.payments.find(
        (p: { method: string }) => p.method === 'credit_terms',
      );
      const pspPayment = order.body.data.payments.find(
        (p: { method: string }) => p.method === 'test_card',
      );
      const creditAmount = creditPayment ? Number(creditPayment.amount) : 0;
      const pspAmount = pspPayment ? Number(pspPayment.amount) : 0;
      expect(creditAmount + pspAmount).toBeCloseTo(15, 4);
    }

    const creditAfter = await request(app)
      .get('/store/v1/me/company/credit')
      .set('Authorization', `Bearer ${token}`);
    // Exactly $50 got charged across all 10 orders — never more, proving the
    // guarded UPDATE (outstanding + amt <= credit_limit) is race-safe under
    // real concurrency, the same proof shape as wallet's own 10-concurrent test.
    expect(creditAfter.body.data.account.outstanding).toBe('50.0000');
    expect(creditAfter.body.data.account.available).toBe('0.0000');
  });

  it('splits a single order across wallet + credit terms, both captured, order still ON_ACCOUNT', async () => {
    const { customerPublicId, token } = await setupCompanyWithCredit(
      'CR-SPLIT',
      '20.00',
      'split@example.com',
    );
    await admin
      .post(`/admin/v1/customers/${customerPublicId}/wallet/actions/credit`)
      .send({ amount: '15.00', bucket: 'STORE_CREDIT', source: 'GOODWILL' });

    const variantId = await createVariant('CR-SPLIT-SKU', '30.00');
    await stockUp(variantId, 5);
    const cartId = await createCartWithLine(variantId, 1, customerPublicId);

    await request(app)
      .post(`/store/v1/carts/${cartId}/actions/apply-wallet`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    const applied = await request(app)
      .post(`/store/v1/carts/${cartId}/actions/apply-credit-terms`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(
      applied.body.data.tenders.map((t: { tenderType: string }) => t.tenderType).sort(),
    ).toEqual(['CREDIT_TERMS', 'WALLET']);
    // grandTotal = 30 + 5 shipping = 35; wallet covers 15, credit covers the remaining 20 (exactly the limit).
    expect(applied.body.data.amountDue).toBe('0.0000');

    const checkout = await request(app).post(`/store/v1/carts/${cartId}/checkout`).send({
      email: 'split@example.com',
      billingAddress: address,
      shippingAddress: address,
      shippingMethodCode: 'CR-STANDARD',
    });
    expect(checkout.status).toBe(201);
    // ANY use of credit terms — even split with another tender — defers
    // settlement; the order is not PAID just because wallet covered part of it.
    expect(checkout.body.data.financialStatus).toBe('ON_ACCOUNT');

    const order = await admin.get(`/admin/v1/orders/${checkout.body.data.publicId}`);
    const methods = order.body.data.payments.map((p: { method: string; amount: string }) => ({
      method: p.method,
      amount: p.amount,
    }));
    expect(methods).toContainEqual({ method: 'wallet', amount: '15.0000' });
    expect(methods).toContainEqual({ method: 'credit_terms', amount: '20.0000' });
  });

  it('cancelling an unfulfilled on-account order reverses the charge and restocks', async () => {
    const { companyPublicId, customerPublicId, token } = await setupCompanyWithCredit(
      'CR-CANCEL',
      '200.00',
      'cancel@example.com',
    );
    const variantId = await createVariant('CR-CANCEL-SKU', '60.00');
    await stockUp(variantId, 5);
    const cartId = await createCartWithLine(variantId, 1, customerPublicId);
    await request(app)
      .post(`/store/v1/carts/${cartId}/actions/apply-credit-terms`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    const checkout = await request(app).post(`/store/v1/carts/${cartId}/checkout`).send({
      email: 'cancel@example.com',
      billingAddress: address,
      shippingAddress: address,
      shippingMethodCode: 'CR-STANDARD',
    });
    expect(checkout.status).toBe(201);
    const orderPublicId = checkout.body.data.publicId as string;

    const creditBefore = await admin.get(`/admin/v1/companies/${companyPublicId}/credit`);
    expect(creditBefore.body.data.outstanding).toBe('65.0000'); // 60 + 5 shipping

    const cancelled = await admin
      .post(`/admin/v1/orders/${orderPublicId}/cancel`)
      .send({ reason: 'Buyer changed their mind' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    // Refunds in this codebase only ever refund subtotal+tax per line, never
    // shipping (pre-existing behavior — see checkout-tender.test.ts's own
    // split-tender-refund test) — so the $5 shipping portion of the credit
    // charge is deliberately left outstanding, same simplification, not a
    // Phase 7 regression.
    const creditAfter = await admin.get(`/admin/v1/companies/${companyPublicId}/credit`);
    expect(creditAfter.body.data.outstanding).toBe('5.0000');

    const stock = await admin
      .get('/admin/v1/inventory/stock')
      .query({ variantId, warehouseCode: 'CR-WH' });
    expect(stock.body.data.available).toBe(5); // restocked
  });

  it('aging report buckets an open invoice correctly by days overdue', async () => {
    const { companyPublicId, customerPublicId, token } = await setupCompanyWithCredit(
      'CR-AGING',
      '200.00',
      'aging@example.com',
    );
    const variantId = await createVariant('CR-AGING-SKU', '90.00');
    await stockUp(variantId, 5);
    const cartId = await createCartWithLine(variantId, 1, customerPublicId);
    await request(app)
      .post(`/store/v1/carts/${cartId}/actions/apply-credit-terms`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    const checkout = await request(app).post(`/store/v1/carts/${cartId}/checkout`).send({
      email: 'aging@example.com',
      billingAddress: address,
      shippingAddress: address,
      shippingMethodCode: 'CR-STANDARD',
    });
    expect(checkout.status).toBe(201);

    // Force the CHARGE row's due_at 45 days into the past (same "seed the DB
    // directly to exercise the sweep/bucket logic" approach checkout-tender's
    // expired-hold test uses) — real due dates are 30 days out under NET_30,
    // far too slow to wait on in a test.
    const account = await prisma.companyCreditAccount.findFirstOrThrow({
      where: { company: { publicId: companyPublicId } },
    });
    await prisma.$executeRaw`UPDATE company_credit_transaction SET due_at = NOW() - INTERVAL '45 days' WHERE credit_account_id = ${account.id} AND type = 'CHARGE'`;

    const aging = await admin.get(`/admin/v1/companies/${companyPublicId}/credit/aging`);
    expect(aging.status).toBe(200);
    expect(aging.body.data.invoices).toHaveLength(1);
    expect(aging.body.data.invoices[0].bucket).toBe('31-60');
    expect(aging.body.data.invoices[0].daysOverdue).toBeGreaterThanOrEqual(45);
    expect(aging.body.data.buckets['31-60']).toBe('95.0000'); // 90 + 5 shipping
    expect(aging.body.data.buckets.current).toBe('0.0000');
  });
});
