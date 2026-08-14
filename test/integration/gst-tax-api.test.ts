import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * The GST tax module over HTTP (live DB): admin Tax Class CRUD, product
 * tax-class/HSN assignment, GST Settings (Website.gstin/originStateCode), and
 * the full checkout-path CGST/SGST vs IGST split — including the
 * intra-vs-inter-state determination, the invoice's per-line HSN/split, and
 * the pre-existing (dormant) 0-GST behavior staying unchanged when nothing's
 * configured. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('GST tax module (live DB)', () => {
  const app = createApp();
  let attributeSetId = '';
  let storeViewId = '';
  let admin: ReturnType<typeof adminRequest>;

  async function createVariant(sku: string, price: string, opts: { taxClassId?: string; hsnCode?: string } = {}): Promise<string> {
    const created = await admin.post('/admin/v1/products').send({
      type: 'SIMPLE',
      sku,
      attributeSetId,
      status: 'ACTIVE',
      taxClassId: opts.taxClassId,
      hsnCode: opts.hsnCode,
    });
    expect(created.status).toBe(201);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    await admin.post('/admin/v1/price-lists').send({ code: `GST-PL-${sku}`, name: sku, currency: 'INR', priority: 0 });
    await admin.put(`/admin/v1/price-lists/GST-PL-${sku}/prices`).send({ variantId: variant.publicId, price });
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId: variant.publicId, warehouseCode: 'GST-WH', delta: 100, reason: 'PURCHASE' });
    return variant.publicId;
  }

  async function newCart(): Promise<string> {
    const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
    expect(cart.status).toBe(201);
    return cart.body.data.publicId;
  }

  function address(stateCode: string, overrides: Record<string, unknown> = {}) {
    return {
      name: 'Jane Doe',
      line1: '123 Main St',
      city: 'Testville',
      stateCode,
      postalCode: '400001',
      country: 'IN',
      ...overrides,
    };
  }

  async function checkout(cartId: string, stateCode: string, overrides: Record<string, unknown> = {}) {
    const shippingAddress = address(stateCode);
    return request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'jane@example.com',
        billingAddress: shippingAddress,
        shippingAddress,
        shippingMethodCode: 'GST-STANDARD',
        paymentMethod: 'test_card',
        ...overrides,
      });
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE order_tax_line, order_address, order_line, "order", cart_line, cart,
       tax_class, shipping_method, price_tier, product_price, price_list,
       stock_reservation, stock_movement, stock_item, product,
       customer_address, customer RESTART IDENTITY CASCADE`,
    );
    const set = await prisma.attributeSet.upsert({
      where: { code: 'gst-test-set' },
      update: {},
      create: { code: 'gst-test-set', name: 'GST Test Set' },
    });
    attributeSetId = set.id.toString();

    await prisma.currency.upsert({
      where: { code: 'INR' },
      update: {},
      create: { code: 'INR', symbol: '₹', minorUnits: 2, name: 'Indian Rupee' },
    });
    const website = await prisma.website.upsert({
      where: { code: 'gst_retail' },
      update: {},
      create: { code: 'gst_retail', name: 'GST Retail', baseCurrency: 'INR', isDefault: false },
    });
    const store = await prisma.store.upsert({
      where: { websiteId_code: { websiteId: website.id, code: 'main' } },
      update: {},
      create: { websiteId: website.id, code: 'main', name: 'Main' },
    });
    const lang = await prisma.language.upsert({
      where: { code: 'en-IN' },
      update: {},
      create: { code: 'en-IN', name: 'English (India)', nativeName: 'English' },
    });
    const sv = await prisma.storeView.upsert({
      where: { storeId_code: { storeId: store.id, code: 'en' } },
      update: {},
      create: { storeId: store.id, code: 'en', languageId: lang.id, currency: 'INR' },
    });
    storeViewId = sv.id.toString();

    admin = adminRequest(app, await getAdminToken(app));

    await admin.post('/admin/v1/warehouses').send({ code: 'GST-WH', name: 'GST Warehouse' });
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: 'GST-WH' } });
    await prisma.storeWarehouse.deleteMany({ where: { storeId: store.id } });
    await prisma.storeWarehouse.create({ data: { storeId: store.id, warehouseId: warehouse.id, priority: 0 } });
    await admin.post('/admin/v1/shipping-methods').send({ code: 'GST-STANDARD', name: 'Standard Shipping', flatRate: '0.00', currency: 'INR' });

    // Maharashtra (27) registration — matches the shipping address used by the
    // "intra-state" tests below; a different state in the "inter-state" tests.
    const settings = await admin.patch(`/admin/v1/websites/${website.code}/tax-settings`).send({ gstin: '27AAAAA0000A1Z5', originStateCode: '27' });
    expect(settings.status).toBe(200);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // --- Admin Tax Class CRUD ---

  it('creates, lists, updates, and deletes a tax class', async () => {
    const created = await admin.post('/admin/v1/tax-classes').send({ code: 'GSTTEST18', name: 'GST 18%', rate: '0.18' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ code: 'GSTTEST18', name: 'GST 18%', rate: '0.1800', isActive: true });
    expect(created.body.data.id).toEqual(expect.any(String));

    const list = await admin.get('/admin/v1/tax-classes');
    expect(list.status).toBe(200);
    expect(list.body.data.map((tc: { code: string }) => tc.code)).toContain('GSTTEST18');

    const updated = await admin.patch('/admin/v1/tax-classes/GSTTEST18').send({ name: 'GST Eighteen Percent', isActive: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: 'GST Eighteen Percent', isActive: false });

    const deleted = await admin.delete('/admin/v1/tax-classes/GSTTEST18');
    expect(deleted.status).toBe(204);
    const listAfter = await admin.get('/admin/v1/tax-classes');
    expect(listAfter.body.data.map((tc: { code: string }) => tc.code)).not.toContain('GSTTEST18');
  });

  it('rejects a duplicate tax class code with 409', async () => {
    await admin.post('/admin/v1/tax-classes').send({ code: 'GSTDUPE', name: 'Dupe', rate: '0.05' });
    const dup = await admin.post('/admin/v1/tax-classes').send({ code: 'GSTDUPE', name: 'Dupe', rate: '0.05' });
    expect(dup.status).toBe(409);
  });

  // --- GST Settings ---

  it('rejects setting only one of gstin/originStateCode (must be paired)', async () => {
    // A fresh website (both fields still null) — beforeAll already paired gst_retail's,
    // so half-setting one of ITS fields wouldn't actually leave it half-set (the other
    // field would just keep its already-paired value).
    await prisma.website.upsert({
      where: { code: 'gst_unpaired_test' },
      update: { gstin: null, originStateCode: null },
      create: { code: 'gst_unpaired_test', name: 'GST Unpaired Test', baseCurrency: 'INR', isDefault: false },
    });
    const res = await admin.patch('/admin/v1/websites/gst_unpaired_test/tax-settings').send({ gstin: '27AAAAA0000A1Z5' });
    expect(res.status).toBe(422);
  });

  // --- Product tax-class/HSN wiring ---

  it('assigns a tax class and HSN code to a product, and reflects it on GET', async () => {
    const gst18 = await admin.post('/admin/v1/tax-classes').send({ code: 'GST18', name: 'GST 18%', rate: '0.18' });
    const created = await admin.post('/admin/v1/products').send({
      type: 'SIMPLE',
      sku: 'GST-PRODUCT-1',
      attributeSetId,
      status: 'ACTIVE',
      taxClassId: gst18.body.data.id,
      hsnCode: '61091000',
    });
    expect(created.status).toBe(201);
    const detail = await admin.get(`/admin/v1/products/${created.body.data.publicId}`);
    expect(detail.body.data.taxClassId).toBe(gst18.body.data.id);
    expect(detail.body.data.hsnCode).toBe('61091000');

    const list = await admin.get('/admin/v1/products?search=GST-PRODUCT-1');
    expect(list.body.data.products.find((p: { sku: string }) => p.sku === 'GST-PRODUCT-1').hasTaxClass).toBe(true);
  });

  // --- Checkout: intra-state (CGST+SGST) vs inter-state (IGST) ---

  it('checkout to the SAME state as the website registration splits into CGST + SGST', async () => {
    const gst18 = await admin.post('/admin/v1/tax-classes').send({ code: 'GST18B', name: 'GST 18%', rate: '0.18' });
    const variantId = await createVariant('GST-SKU-INTRA', '100.00', { taxClassId: gst18.body.data.id, hsnCode: '85171200' });
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

    const res = await checkout(cartId, '27'); // Maharashtra — matches the website's originStateCode
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.taxTotal).toBe('18.0000');
    expect(order.grandTotal).toBe('118.0000'); // 100 + 18 tax + 0 shipping

    const taxLines: Array<{ taxType: string; rate: string; amount: string }> = order.taxLines;
    expect(taxLines).toHaveLength(2);
    const cgst = taxLines.find((t) => t.taxType === 'CGST')!;
    const sgst = taxLines.find((t) => t.taxType === 'SGST')!;
    expect(cgst).toMatchObject({ rate: '0.0900', amount: '9.0000' });
    expect(sgst).toMatchObject({ rate: '0.0900', amount: '9.0000' });

    expect(order.lines[0].hsnCode).toBe('85171200');
    expect(order.lines[0].taxAmount).toBe('18.0000');

    // Full invoice reflects the same split (invoice covers every order line).
    const invoiced = await admin.post(`/admin/v1/orders/${order.publicId}/invoice`).send({});
    expect(invoiced.status).toBe(201);
    expect(invoiced.body.data.invoices.at(-1).taxTotal).toBe('18.0000');
  });

  it('checkout to a DIFFERENT state from the website registration charges a single IGST line', async () => {
    const gst18 = await admin.post('/admin/v1/tax-classes').send({ code: 'GST18C', name: 'GST 18%', rate: '0.18' });
    const variantId = await createVariant('GST-SKU-INTER', '100.00', { taxClassId: gst18.body.data.id });
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

    const res = await checkout(cartId, '07'); // Delhi — different from the website's Maharashtra (27) registration
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.taxTotal).toBe('18.0000');

    const taxLines: Array<{ taxType: string; rate: string; amount: string }> = order.taxLines;
    expect(taxLines).toHaveLength(1);
    expect(taxLines[0]).toMatchObject({ taxType: 'IGST', rate: '0.1800', amount: '18.0000' });
  });

  it('a product with no tax class assigned still checks out cleanly, charged 0 GST (documented silent-zero behavior)', async () => {
    const variantId = await createVariant('GST-SKU-NOTAX', '50.00'); // no taxClassId
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

    const res = await checkout(cartId, '27');
    expect(res.status).toBe(201);
    expect(res.body.data.taxTotal).toBe('0.0000');
    expect(res.body.data.taxLines).toEqual([]);
    expect(res.body.data.grandTotal).toBe('50.0000');
  });

  it('a cart mixing a taxed and an untaxed product only produces tax lines for the taxed one', async () => {
    const gst18 = await admin.post('/admin/v1/tax-classes').send({ code: 'GST18D', name: 'GST 18%', rate: '0.18' });
    const taxedVariant = await createVariant('GST-SKU-MIX-TAXED', '100.00', { taxClassId: gst18.body.data.id });
    const untaxedVariant = await createVariant('GST-SKU-MIX-UNTAXED', '20.00');
    const cartId = await newCart();
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId: taxedVariant, qty: 1 });
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId: untaxedVariant, qty: 1 });

    const res = await checkout(cartId, '27');
    expect(res.status).toBe(201);
    expect(res.body.data.taxTotal).toBe('18.0000'); // only the taxed line contributes
    expect(res.body.data.taxLines).toHaveLength(2); // CGST + SGST, one class only
  });

  // --- Website.pricesIncludeTax: catalog price is the final price, GST is backed out ---

  describe('tax-inclusive pricing (Website.pricesIncludeTax)', () => {
    let inclusiveStoreViewId = '';
    let inclusiveTaxClassId = '';

    beforeAll(async () => {
      const website = await prisma.website.upsert({
        where: { code: 'gst_inclusive_retail' },
        update: {},
        create: { code: 'gst_inclusive_retail', name: 'GST Inclusive Retail', baseCurrency: 'INR', isDefault: false },
      });
      const store = await prisma.store.upsert({
        where: { websiteId_code: { websiteId: website.id, code: 'main' } },
        update: {},
        create: { websiteId: website.id, code: 'main', name: 'Main' },
      });
      const lang = await prisma.language.upsert({
        where: { code: 'en-IN' },
        update: {},
        create: { code: 'en-IN', name: 'English (India)', nativeName: 'English' },
      });
      const sv = await prisma.storeView.upsert({
        where: { storeId_code: { storeId: store.id, code: 'en' } },
        update: {},
        create: { storeId: store.id, code: 'en', languageId: lang.id, currency: 'INR' },
      });
      inclusiveStoreViewId = sv.id.toString();

      await admin.post('/admin/v1/warehouses').send({ code: 'GST-WH-INCL', name: 'GST Inclusive Warehouse' });
      const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: 'GST-WH-INCL' } });
      await prisma.storeWarehouse.deleteMany({ where: { storeId: store.id } });
      await prisma.storeWarehouse.create({ data: { storeId: store.id, warehouseId: warehouse.id, priority: 0 } });
      await admin.post('/admin/v1/shipping-methods').send({ code: 'GST-STANDARD-INCL', name: 'Standard Shipping', flatRate: '0.00', currency: 'INR' });

      // Maharashtra (27) registration, same as gst_retail — AND pricesIncludeTax
      // on, so a catalog price is the final price the customer pays, not a base
      // to add GST on top of.
      const settings = await admin
        .patch(`/admin/v1/websites/${website.code}/tax-settings`)
        .send({ gstin: '27AAAAA0000A1Z5', originStateCode: '27', pricesIncludeTax: true });
      expect(settings.status).toBe(200);
      expect(settings.body.data.pricesIncludeTax).toBe(true);

      const gst18 = await admin.post('/admin/v1/tax-classes').send({ code: 'GST18INCL', name: 'GST 18% (inclusive)', rate: '0.18' });
      inclusiveTaxClassId = gst18.body.data.id;
    });

    async function createInclusiveVariant(sku: string, price: string): Promise<string> {
      const created = await admin.post('/admin/v1/products').send({
        type: 'SIMPLE',
        sku,
        attributeSetId,
        status: 'ACTIVE',
        taxClassId: inclusiveTaxClassId,
        hsnCode: '85171200',
      });
      expect(created.status).toBe(201);
      const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
      await admin.post('/admin/v1/price-lists').send({ code: `GST-PL-${sku}`, name: sku, currency: 'INR', priority: 0 });
      await admin.put(`/admin/v1/price-lists/GST-PL-${sku}/prices`).send({ variantId: variant.publicId, price });
      await admin.post('/admin/v1/inventory/adjustments').send({ variantId: variant.publicId, warehouseCode: 'GST-WH-INCL', delta: 100, reason: 'PURCHASE' });
      return variant.publicId;
    }

    async function checkoutInclusive(cartId: string, stateCode: string) {
      const shippingAddress = address(stateCode);
      return request(app)
        .post(`/store/v1/carts/${cartId}/checkout`)
        .send({
          email: 'jane@example.com',
          billingAddress: shippingAddress,
          shippingAddress,
          shippingMethodCode: 'GST-STANDARD-INCL',
          paymentMethod: 'test_card',
        });
    }

    it('same-state checkout: GST is backed out of the ₹1299 catalog price, not added on top — the customer still pays ₹1299', async () => {
      const variantId = await createInclusiveVariant('GST-SKU-INCL-INTRA', '1299.00');
      const cart = await request(app).post('/store/v1/carts').send({ storeViewId: inclusiveStoreViewId });
      const cartId = cart.body.data.publicId;
      await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

      const res = await checkoutInclusive(cartId, '27'); // Maharashtra — same as the website's registration
      expect(res.status).toBe(201);
      const order = res.body.data;

      // Backed-out taxable base + tax sum back to exactly the catalog price —
      // never a naive "add 18% on top" of the listed ₹1299.
      expect(order.subtotal).toBe('1100.8474');
      expect(order.taxTotal).toBe('198.1526');
      expect(order.grandTotal).toBe('1299.0000'); // shipping is 0.00 on this method — grandTotal === the catalog price, unchanged by the toggle.

      const taxLines: Array<{ taxType: string; rate: string; amount: string }> = order.taxLines;
      expect(taxLines).toHaveLength(2);
      expect(taxLines.find((t) => t.taxType === 'CGST')).toMatchObject({ rate: '0.0900', amount: '99.0763' });
      expect(taxLines.find((t) => t.taxType === 'SGST')).toMatchObject({ rate: '0.0900', amount: '99.0763' });

      expect(order.lines[0].hsnCode).toBe('85171200');
      // rowTotal (subtotal + tax for this one-line order) is the real money check —
      // it must equal the catalog price exactly, same guarantee as grandTotal above.
      expect(order.lines[0].rowTotal).toBe('1299.0000');
    });

    it('different-state checkout: a single IGST line, still backed out of the same ₹1299 catalog price', async () => {
      const variantId = await createInclusiveVariant('GST-SKU-INCL-INTER', '1299.00');
      const cart = await request(app).post('/store/v1/carts').send({ storeViewId: inclusiveStoreViewId });
      const cartId = cart.body.data.publicId;
      await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 1 });

      const res = await checkoutInclusive(cartId, '07'); // Delhi — different from the website's Maharashtra (27) registration
      expect(res.status).toBe(201);
      const order = res.body.data;

      expect(order.subtotal).toBe('1100.8474');
      expect(order.taxTotal).toBe('198.1526');
      expect(order.grandTotal).toBe('1299.0000');

      const taxLines: Array<{ taxType: string; rate: string; amount: string }> = order.taxLines;
      expect(taxLines).toHaveLength(1);
      expect(taxLines[0]).toMatchObject({ taxType: 'IGST', rate: '0.1800', amount: '198.1526' });
    });

    it('a qty>2 inclusive line still sums exactly: rowTotal === unitPrice-derived subtotal + tax, never a fabricated total', async () => {
      const variantId = await createInclusiveVariant('GST-SKU-INCL-QTY', '118.00'); // clean rate, divides evenly: 100.00 excl + 18.00 tax
      const cart = await request(app).post('/store/v1/carts').send({ storeViewId: inclusiveStoreViewId });
      const cartId = cart.body.data.publicId;
      await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty: 3 });

      const res = await checkoutInclusive(cartId, '27');
      expect(res.status).toBe(201);
      const order = res.body.data;
      // 3 x 118.00 = 354.00 total catalog price -> 300.00 exclusive + 54.00 tax.
      expect(order.subtotal).toBe('300.0000');
      expect(order.taxTotal).toBe('54.0000');
      expect(order.grandTotal).toBe('354.0000');
      expect(order.lines[0].rowTotal).toBe('354.0000');
    });
  });
});
