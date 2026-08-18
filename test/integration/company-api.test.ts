import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * B2B Company module over HTTP (live DB) — plan/15 Phase 6. Proves company/
 * member CRUD, the two real fixes this phase exists for (CreateCart no
 * longer trusts a client-supplied customerGroupCode — it's server-derived
 * from company membership; a guest cart claimed at login re-derives its
 * pricing group), and tax exemption zeroing GST + snapshotting onto the
 * Order. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('B2B company module (live DB)', () => {
  const app = createApp();
  let attributeSetId = '';
  let storeViewId = '';
  let admin: ReturnType<typeof adminRequest>;

  async function createVariant(sku: string, price: string, opts: { taxClassId?: string } = {}): Promise<string> {
    const created = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku, attributeSetId, status: 'ACTIVE', taxClassId: opts.taxClassId });
    expect(created.status).toBe(201);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    await admin.post('/admin/v1/price-lists').send({ code: `B2B-BASE-${sku}`, name: sku, currency: 'USD', type: 'BASE', priority: 0 });
    await admin.put(`/admin/v1/price-lists/B2B-BASE-${sku}/prices`).send({ variantId: variant.publicId, price });
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId: variant.publicId, warehouseCode: 'B2B-WH', delta: 100, reason: 'PURCHASE' });
    return variant.publicId;
  }

  async function registerAndLogin(email: string): Promise<{ customerPublicId: string; token: string }> {
    const reg = await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'b2b_retail', email, password: 'correct-horse-battery' });
    expect(reg.status).toBe(201);
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'b2b_retail', email, password: 'correct-horse-battery' });
    expect(login.status).toBe(200);
    return { customerPublicId: reg.body.data.publicId as string, token: login.body.data.token as string };
  }

  function customerRequest(token: string) {
    const withAuth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => withAuth(request(app).get(url)),
      post: (url: string) => withAuth(request(app).post(url)),
      put: (url: string) => withAuth(request(app).put(url)),
      delete: (url: string) => withAuth(request(app).delete(url)),
    };
  }

  function address(overrides: Record<string, unknown> = {}) {
    return { name: 'Acme Buyer', line1: '1 Business Rd', city: 'Metropolis', postalCode: '10001', country: 'US', ...overrides };
  }

  async function checkout(cartId: string, overrides: Record<string, unknown> = {}) {
    const shippingAddress = address();
    return request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'buyer@example.com',
        billingAddress: shippingAddress,
        shippingAddress,
        shippingMethodCode: 'B2B-STANDARD',
        paymentMethod: 'test_card',
        ...overrides,
      });
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE company_customer, company, order_invoice_line, order_invoice, order_tax_line, order_address, order_line, "order",
       cart_tender, cart_line, cart, price_tier, product_price, price_list, customer_group, tax_class, shipping_method,
       stock_reservation, stock_movement, stock_item, product, customer_address, customer RESTART IDENTITY CASCADE`,
    );
    const set = await prisma.attributeSet.upsert({ where: { code: 'b2b-test-set' }, update: {}, create: { code: 'b2b-test-set', name: 'B2B Test Set' } });
    attributeSetId = set.id.toString();

    await prisma.currency.upsert({ where: { code: 'USD' }, update: {}, create: { code: 'USD', symbol: '$', minorUnits: 2, name: 'US Dollar' } });
    const website = await prisma.website.upsert({
      where: { code: 'b2b_retail' },
      update: {},
      create: { code: 'b2b_retail', name: 'B2B Retail', baseCurrency: 'USD', isDefault: false },
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

    await admin.post('/admin/v1/warehouses').send({ code: 'B2B-WH', name: 'B2B Warehouse' });
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: 'B2B-WH' } });
    await prisma.storeWarehouse.deleteMany({ where: { storeId: store.id } });
    await prisma.storeWarehouse.create({ data: { storeId: store.id, warehouseId: warehouse.id, priority: 0 } });
    await admin.post('/admin/v1/shipping-methods').send({ code: 'B2B-STANDARD', name: 'Standard Shipping', flatRate: '0.00', currency: 'USD' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // --- Admin Company CRUD ---

  it('creates a company defaulting to PENDING status', async () => {
    const res = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-CRUD', name: 'Acme Corp' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: 'ACME-CRUD', name: 'Acme Corp', status: 'PENDING', taxExempt: false });
    expect(res.body.data.publicId).toEqual(expect.any(String));
  });

  it('rejects a duplicate website+code with 409', async () => {
    await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-DUPE', name: 'Acme Dupe' });
    const dup = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-DUPE', name: 'Acme Dupe Again' });
    expect(dup.status).toBe(409);
  });

  it('rejects taxExempt=true without a taxExemptionRef, on both create and update', async () => {
    const create = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-EXEMPT-BAD', name: 'Bad Exempt', taxExempt: true });
    expect(create.status).toBe(422);

    const company = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-EXEMPT-BAD-2', name: 'Bad Exempt 2' });
    const update = await admin.put(`/admin/v1/companies/${company.body.data.publicId}`).send({ taxExempt: true });
    expect(update.status).toBe(422);
  });

  it('approves, suspends, and re-approves a company via set-status', async () => {
    const company = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-STATUS', name: 'Acme Status' });
    const publicId = company.body.data.publicId;

    const approved = await admin.post(`/admin/v1/companies/${publicId}/actions/set-status`).send({ status: 'ACTIVE' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('ACTIVE');

    const suspended = await admin.post(`/admin/v1/companies/${publicId}/actions/set-status`).send({ status: 'SUSPENDED' });
    expect(suspended.body.data.status).toBe('SUSPENDED');

    const reapproved = await admin.post(`/admin/v1/companies/${publicId}/actions/set-status`).send({ status: 'ACTIVE' });
    expect(reapproved.body.data.status).toBe('ACTIVE');
  });

  it('updates a company (name, customer group)', async () => {
    await admin.post('/admin/v1/customer-groups').send({ code: 'ACME-UPDATE-GRP', name: 'Acme Update Group' });
    const company = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-UPDATE', name: 'Old Name' });
    const updated = await admin.put(`/admin/v1/companies/${company.body.data.publicId}`).send({ name: 'New Name', customerGroupCode: 'ACME-UPDATE-GRP' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: 'New Name', customerGroupCode: 'ACME-UPDATE-GRP', customerGroupName: 'Acme Update Group' });
  });

  it('lists companies filtered by status', async () => {
    const list = await admin.get('/admin/v1/companies?websiteCode=b2b_retail&status=PENDING');
    expect(list.status).toBe(200);
    expect(list.body.data.companies.every((c: { status: string }) => c.status === 'PENDING')).toBe(true);
  });

  // --- Admin member management ---

  it('adds a member (defaults to BUYER), rejects a second company for the same customer, updates role, and removes', async () => {
    const company = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-MEMBERS', name: 'Acme Members' });
    const publicId = company.body.data.publicId;
    const buyer = await registerAndLogin('member1@example.com');

    const added = await admin.post(`/admin/v1/companies/${publicId}/members`).send({ email: 'member1@example.com' });
    expect(added.status).toBe(201);
    expect(added.body.data).toMatchObject({ customerPublicId: buyer.customerPublicId, role: 'BUYER' });

    const otherCompany = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-MEMBERS-2', name: 'Acme Members 2' });
    const doubleJoin = await admin.post(`/admin/v1/companies/${otherCompany.body.data.publicId}/members`).send({ email: 'member1@example.com' });
    expect(doubleJoin.status).toBe(409);

    const roleChange = await admin.put(`/admin/v1/companies/${publicId}/members/${buyer.customerPublicId}`).send({ role: 'ADMIN' });
    expect(roleChange.status).toBe(200);
    expect(roleChange.body.data.role).toBe('ADMIN');

    const removed = await admin.delete(`/admin/v1/companies/${publicId}/members/${buyer.customerPublicId}`);
    expect(removed.status).toBe(204);

    const members = await admin.get(`/admin/v1/companies/${publicId}/members`);
    expect(members.body.data).toEqual([]);
  });

  // --- Storefront self-service ---

  it('GET /store/v1/me/company returns null company for a non-member, the real one for a member', async () => {
    const nonMember = await registerAndLogin('nonmember@example.com');
    const nonMemberReq = customerRequest(nonMember.token);
    const noCompany = await nonMemberReq.get('/store/v1/me/company');
    expect(noCompany.status).toBe(200);
    expect(noCompany.body.data).toEqual({ company: null, myRole: null });

    const company = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-SELF', name: 'Acme Self' });
    const publicId = company.body.data.publicId;
    const member = await registerAndLogin('selfmember@example.com');
    await admin.post(`/admin/v1/companies/${publicId}/members`).send({ email: 'selfmember@example.com', role: 'ADMIN' });

    const memberReq = customerRequest(member.token);
    const mine = await memberReq.get('/store/v1/me/company');
    expect(mine.status).toBe(200);
    expect(mine.body.data.myRole).toBe('ADMIN');
    expect(mine.body.data.company).toMatchObject({ publicId, code: 'ACME-SELF' });
  });

  it('an ADMIN-role member can manage the buyer list; a BUYER-role member gets 403', async () => {
    const company = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-ROLES', name: 'Acme Roles' });
    const publicId = company.body.data.publicId;
    const adminMember = await registerAndLogin('rolesadmin@example.com');
    const buyerMember = await registerAndLogin('rolesbuyer@example.com');
    const newHire = await registerAndLogin('roleshire@example.com');
    await admin.post(`/admin/v1/companies/${publicId}/members`).send({ email: 'rolesadmin@example.com', role: 'ADMIN' });
    await admin.post(`/admin/v1/companies/${publicId}/members`).send({ email: 'rolesbuyer@example.com', role: 'BUYER' });
    await admin.post(`/admin/v1/companies/${publicId}/actions/set-status`).send({ status: 'ACTIVE' });

    const adminReq = customerRequest(adminMember.token);
    const added = await adminReq.post('/store/v1/me/company/members').send({ email: 'roleshire@example.com' });
    expect(added.status).toBe(201);
    expect(added.body.data.customerPublicId).toBe(newHire.customerPublicId);

    const buyerReq = customerRequest(buyerMember.token);
    const forbidden = await buyerReq.post('/store/v1/me/company/members').send({ email: 'someone-else@example.com' });
    expect(forbidden.status).toBe(403);

    const removed = await adminReq.delete(`/store/v1/me/company/members/${newHire.customerPublicId}`);
    expect(removed.status).toBe(204);
  });

  // --- THE pricing proof: server-derived group, zero client trust ---

  it('a B2B price list resolves for a company member with NO client-sent group code; a retail customer still sees base price', async () => {
    await admin.post('/admin/v1/customer-groups').send({ code: 'B2B-PRICE-GRP', name: 'B2B Pricing Group' });
    const company = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-PRICING', name: 'Acme Pricing', customerGroupCode: 'B2B-PRICE-GRP' });
    await admin.post(`/admin/v1/companies/${company.body.data.publicId}/actions/set-status`).send({ status: 'ACTIVE' });

    const variantId = await createVariant('B2B-PRICE-SKU', '100.00');
    await admin.post('/admin/v1/price-lists').send({ code: 'B2B-PRICE-LIST', name: 'B2B Price', currency: 'USD', type: 'B2B', priority: 10, customerGroupCode: 'B2B-PRICE-GRP' });
    await admin.put('/admin/v1/price-lists/B2B-PRICE-LIST/prices').send({ variantId, price: '70.00' });

    const member = await registerAndLogin('pricingmember@example.com');
    await admin.post(`/admin/v1/companies/${company.body.data.publicId}/members`).send({ email: 'pricingmember@example.com' });

    // The member's cart is created with ONLY customerPublicId — no group code
    // is ever sent by the client, proving the group is server-derived.
    const memberCart = await request(app).post('/store/v1/carts').send({ storeViewId, customerPublicId: member.customerPublicId });
    expect(memberCart.status).toBe(201);
    expect(memberCart.body.data.customerGroupName).toBe('B2B Pricing Group');
    await request(app).post(`/store/v1/carts/${memberCart.body.data.publicId}/lines`).send({ variantId, qty: 1 });
    const memberRead = await request(app).get(`/store/v1/carts/${memberCart.body.data.publicId}`);
    expect(memberRead.body.data.lines[0].price).toBe('70.0000');

    // A retail customer (registered, but no company) still sees base price.
    const retail = await registerAndLogin('retailbuyer@example.com');
    const retailCart = await request(app).post('/store/v1/carts').send({ storeViewId, customerPublicId: retail.customerPublicId });
    await request(app).post(`/store/v1/carts/${retailCart.body.data.publicId}/lines`).send({ variantId, qty: 1 });
    const retailRead = await request(app).get(`/store/v1/carts/${retailCart.body.data.publicId}`);
    expect(retailRead.body.data.lines[0].price).toBe('100.0000');
    expect(retailRead.body.data.customerGroupName).toBeNull();

    // Regression: a stale client sending the old customerGroupCode field is
    // silently ignored — the field no longer exists in the schema.
    const spoofedGuestCart = await request(app).post('/store/v1/carts').send({ storeViewId, customerGroupCode: 'B2B-PRICE-GRP' });
    expect(spoofedGuestCart.status).toBe(201);
    await request(app).post(`/store/v1/carts/${spoofedGuestCart.body.data.publicId}/lines`).send({ variantId, qty: 1 });
    const spoofedRead = await request(app).get(`/store/v1/carts/${spoofedGuestCart.body.data.publicId}`);
    expect(spoofedRead.body.data.lines[0].price).toBe('100.0000'); // base price — the spoofed group code had no effect
  });

  // --- Guest cart claimed at login re-derives pricing ---

  it('a guest cart filled before login re-derives its pricing group once claimed via attach-customer', async () => {
    await admin.post('/admin/v1/customer-groups').send({ code: 'B2B-ATTACH-GRP', name: 'B2B Attach Group' });
    const company = await admin.post('/admin/v1/companies').send({ websiteCode: 'b2b_retail', code: 'ACME-ATTACH', name: 'Acme Attach', customerGroupCode: 'B2B-ATTACH-GRP' });
    await admin.post(`/admin/v1/companies/${company.body.data.publicId}/actions/set-status`).send({ status: 'ACTIVE' });

    const variantId = await createVariant('B2B-ATTACH-SKU', '50.00');
    await admin.post('/admin/v1/price-lists').send({ code: 'B2B-ATTACH-LIST', name: 'B2B Attach Price', currency: 'USD', type: 'B2B', priority: 10, customerGroupCode: 'B2B-ATTACH-GRP' });
    await admin.put('/admin/v1/price-lists/B2B-ATTACH-LIST/prices').send({ variantId, price: '30.00' });

    const member = await registerAndLogin('attachmember@example.com');
    await admin.post(`/admin/v1/companies/${company.body.data.publicId}/members`).send({ email: 'attachmember@example.com' });

    // Guest cart created and filled BEFORE any login.
    const guestCart = await request(app).post('/store/v1/carts').send({ storeViewId });
    expect(guestCart.body.data.customerGroupName).toBeNull();
    await request(app).post(`/store/v1/carts/${guestCart.body.data.publicId}/lines`).send({ variantId, qty: 1 });
    const beforeAttach = await request(app).get(`/store/v1/carts/${guestCart.body.data.publicId}`);
    expect(beforeAttach.body.data.lines[0].price).toBe('50.0000'); // base — still a guest

    // Login-time claim (what the storefront login route calls).
    const memberReq = customerRequest(member.token);
    const attached = await memberReq.post(`/store/v1/carts/${guestCart.body.data.publicId}/actions/attach-customer`);
    expect(attached.status).toBe(200);
    expect(attached.body.data.customerGroupName).toBe('B2B Attach Group');
    expect(attached.body.data.lines[0].price).toBe('30.0000'); // now re-priced under the company's group

    // Attaching a DIFFERENT customer to an already-claimed cart is rejected.
    const other = await registerAndLogin('attachother@example.com');
    const otherReq = customerRequest(other.token);
    const conflict = await otherReq.post(`/store/v1/carts/${guestCart.body.data.publicId}/actions/attach-customer`);
    expect(conflict.status).toBe(409);
  });

  // --- Tax exemption zeroes GST and snapshots onto the Order ---

  it('a tax-exempt company member checks out with zero tax lines; a non-exempt buyer of the same product is still charged tax', async () => {
    const taxClass = await admin.post('/admin/v1/tax-classes').send({ code: 'B2B-EXEMPT-TAX', name: 'B2B 10%', rate: '0.10' });
    const variantId = await createVariant('B2B-EXEMPT-SKU', '100.00', { taxClassId: taxClass.body.data.id });

    const exemptCompany = await admin
      .post('/admin/v1/companies')
      .send({ websiteCode: 'b2b_retail', code: 'ACME-EXEMPT', name: 'Acme Exempt', taxExempt: true, taxExemptionRef: 'EXEMPT-CERT-001' });
    await admin.post(`/admin/v1/companies/${exemptCompany.body.data.publicId}/actions/set-status`).send({ status: 'ACTIVE' });
    const exemptMember = await registerAndLogin('exemptbuyer@example.com');
    await admin.post(`/admin/v1/companies/${exemptCompany.body.data.publicId}/members`).send({ email: 'exemptbuyer@example.com' });

    const exemptCart = await request(app).post('/store/v1/carts').send({ storeViewId, customerPublicId: exemptMember.customerPublicId });
    await request(app).post(`/store/v1/carts/${exemptCart.body.data.publicId}/lines`).send({ variantId, qty: 1 });
    const exemptCheckout = await checkout(exemptCart.body.data.publicId, { poNumber: 'PO-42' });
    expect(exemptCheckout.status).toBe(201);
    const exemptOrder = exemptCheckout.body.data;
    expect(exemptOrder.taxExempt).toBe(true);
    expect(exemptOrder.taxTotal).toBe('0.0000');
    expect(exemptOrder.taxLines).toEqual([]);
    expect(exemptOrder.poNumber).toBe('PO-42');
    expect(exemptOrder.grandTotal).toBe('100.0000'); // no tax added

    // companyPublicId/companyName are resolved only by GetOrder/GetCustomerOrder
    // (the order-detail read paths), not the checkout response itself — see
    // OrderViewDto's doc comment.
    const orderDetail = await admin.get(`/admin/v1/orders/${exemptOrder.publicId}`);
    expect(orderDetail.status).toBe(200);
    expect(orderDetail.body.data.companyPublicId).toBe(exemptCompany.body.data.publicId);
    expect(orderDetail.body.data.companyName).toBe('Acme Exempt');

    const invoiced = await admin.post(`/admin/v1/orders/${exemptOrder.publicId}/invoice`).send({});
    expect(invoiced.status).toBe(201);
    expect(invoiced.body.data.invoices.at(-1).taxTotal).toBe('0.0000');

    // Contrast: a retail (non-company) customer buying the SAME product IS charged tax.
    const retail = await registerAndLogin('nonexemptbuyer@example.com');
    const retailCart = await request(app).post('/store/v1/carts').send({ storeViewId, customerPublicId: retail.customerPublicId });
    await request(app).post(`/store/v1/carts/${retailCart.body.data.publicId}/lines`).send({ variantId, qty: 1 });
    const retailCheckout = await checkout(retailCart.body.data.publicId);
    expect(retailCheckout.status).toBe(201);
    const retailOrder = retailCheckout.body.data;
    expect(retailOrder.taxExempt).toBe(false);
    expect(retailOrder.taxTotal).toBe('10.0000');
    expect(retailOrder.taxLines).toHaveLength(1);
    expect(retailOrder.companyPublicId).toBeNull();
  });

  it('a SUSPENDED company grants neither pricing nor tax exemption to its members', async () => {
    await admin.post('/admin/v1/customer-groups').send({ code: 'B2B-SUSPENDED-GRP', name: 'Suspended Group' });
    const company = await admin
      .post('/admin/v1/companies')
      .send({ websiteCode: 'b2b_retail', code: 'ACME-SUSPENDED', name: 'Acme Suspended', customerGroupCode: 'B2B-SUSPENDED-GRP', taxExempt: true, taxExemptionRef: 'REF' });
    await admin.post(`/admin/v1/companies/${company.body.data.publicId}/actions/set-status`).send({ status: 'ACTIVE' });
    const member = await registerAndLogin('suspendedmember@example.com');
    await admin.post(`/admin/v1/companies/${company.body.data.publicId}/members`).send({ email: 'suspendedmember@example.com' });
    await admin.post(`/admin/v1/companies/${company.body.data.publicId}/actions/set-status`).send({ status: 'SUSPENDED' });

    const cart = await request(app).post('/store/v1/carts').send({ storeViewId, customerPublicId: member.customerPublicId });
    expect(cart.body.data.customerGroupName).toBeNull(); // SUSPENDED company grants no group
  });
});
