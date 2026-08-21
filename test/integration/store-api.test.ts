import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Currency Setup (admin CRUD over the `currency` reference table) — live DB.
 * Doesn't truncate `currency`: it's a shared fixture (USD) other suites' price
 * lists have raw-SQL FKs into (prisma/sql/0003_pricing_raw.sql), so every test
 * here uses its own unique code instead. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('store API (live DB)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;

  const testCodes = ['ZZT', 'ZZU', 'ZZV', 'ZZW', 'ZZX', 'ZZY', 'ZZZ'];

  beforeAll(async () => {
    admin = adminRequest(app, await getAdminToken(app));
    // Clean up any leftovers from a prior run against this same (non-truncated) DB —
    // currency isn't reset between suites the way scope-specific tables are. Uses raw
    // SQL, not prisma.priceList.deleteMany: price_list has deletedAt, so the shared
    // soft-delete extension (shared/infrastructure/prisma/client.ts) silently remaps
    // deleteMany to an UPDATE — the row stays physically present and keeps blocking
    // the currency FK forever. Match by the FK relationship (currency), not just the
    // one hardcoded price-list code, so this can't be defeated by a stray row left
    // over some other way.
    await prisma.$executeRaw`DELETE FROM price_list WHERE currency = ANY(${testCodes})`;
    await prisma.currency.deleteMany({ where: { code: { in: testCodes } } });
    // Known baseline for the isDefault tests below, regardless of what any other
    // manual testing against this DB set as the default beforehand.
    await prisma.currency.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a currency, then lists it', async () => {
    const created = await admin
      .post('/admin/v1/currencies')
      .send({ code: 'zzt', symbol: 'Z', name: 'Test Currency', minorUnits: 2 });
    expect(created.status).toBe(201);
    // code is normalized to uppercase regardless of what was typed.
    expect(created.body.data).toMatchObject({ code: 'ZZT', symbol: 'Z', name: 'Test Currency', minorUnits: 2 });

    const list = await admin.get('/admin/v1/currencies');
    expect(list.status).toBe(200);
    expect(list.body.data.map((c: { code: string }) => c.code)).toContain('ZZT');
  });

  it('rejects a duplicate currency code with 409', async () => {
    await admin.post('/admin/v1/currencies').send({ code: 'ZZU', symbol: 'U', name: 'Dup Currency' });
    const dup = await admin.post('/admin/v1/currencies').send({ code: 'ZZU', symbol: 'U', name: 'Dup Currency' });
    expect(dup.status).toBe(409);
  });

  it('updates a currency\'s symbol/name/minorUnits, code stays fixed', async () => {
    await admin.post('/admin/v1/currencies').send({ code: 'ZZV', symbol: 'V', name: 'Original' });
    const updated = await admin.patch('/admin/v1/currencies/ZZV').send({ name: 'Renamed', minorUnits: 0 });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ code: 'ZZV', symbol: 'V', name: 'Renamed', minorUnits: 0 });
  });

  it('404s updating an unknown currency', async () => {
    const res = await admin.patch('/admin/v1/currencies/NOPE').send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('a newly registered currency actually unblocks price-list creation with it', async () => {
    await admin.post('/admin/v1/currencies').send({ code: 'ZZW', symbol: 'W', name: 'Price List Test Currency' });
    const priceList = await admin
      .post('/admin/v1/price-lists')
      .send({ code: 'PL-ZZW', name: 'ZZW List', currency: 'ZZW' });
    expect(priceList.status).toBe(201);
  });

  it('setting a currency as default un-sets whichever one was default before', async () => {
    await admin.post('/admin/v1/currencies').send({ code: 'ZZX', symbol: 'X', name: 'First Default' });
    await admin.post('/admin/v1/currencies').send({ code: 'ZZY', symbol: 'Y', name: 'Second Default' });

    const first = await admin.patch('/admin/v1/currencies/ZZX').send({ isDefault: true });
    expect(first.status).toBe(200);
    expect(first.body.data.isDefault).toBe(true);

    let list = await admin.get('/admin/v1/currencies');
    let defaults = list.body.data.filter((c: { isDefault: boolean }) => c.isDefault);
    expect(defaults.map((c: { code: string }) => c.code)).toEqual(['ZZX']);

    const second = await admin.patch('/admin/v1/currencies/ZZY').send({ isDefault: true });
    expect(second.status).toBe(200);
    expect(second.body.data.isDefault).toBe(true);

    list = await admin.get('/admin/v1/currencies');
    defaults = list.body.data.filter((c: { isDefault: boolean }) => c.isDefault);
    // Exactly one default at a time — ZZX got unset when ZZY became default.
    expect(defaults.map((c: { code: string }) => c.code)).toEqual(['ZZY']);
  });

  it('deletes an unused currency', async () => {
    await admin.post('/admin/v1/currencies').send({ code: 'ZZZ', symbol: 'Z', name: 'Deletable' });
    const deleted = await admin.delete('/admin/v1/currencies/ZZZ');
    expect(deleted.status).toBe(204);

    const list = await admin.get('/admin/v1/currencies');
    expect(list.body.data.map((c: { code: string }) => c.code)).not.toContain('ZZZ');
  });

  it('404s deleting an unknown currency', async () => {
    const res = await admin.delete('/admin/v1/currencies/NOPE');
    expect(res.status).toBe(404);
  });

  it('rejects deleting a currency that is still in use with a clean 409, not a raw FK 500', async () => {
    // ZZW still has PL-ZZW pricing against it from the earlier test.
    const res = await admin.delete('/admin/v1/currencies/ZZW');
    expect(res.status).toBe(409);
    expect(res.body.title).toMatch(/still in use/i);
  });

  describe('public website read (header/footer logo)', () => {
    const testCode = 'zzz_logo_test_site';

    beforeAll(async () => {
      await prisma.website.upsert({
        where: { code: testCode },
        update: { name: 'Logo Test Site', logoMediaKey: null },
        create: { code: testCode, name: 'Logo Test Site', baseCurrency: 'USD' },
      });
    });

    it('404s an unknown website code', async () => {
      const res = await admin.get('/store/v1/website').query({ code: 'does-not-exist' });
      expect(res.status).toBe(404);
    });

    it('400s a missing code query param', async () => {
      const res = await admin.get('/store/v1/website');
      expect(res.status).toBe(422);
    });

    it('returns the name and a null logoUrl when no logo is set', async () => {
      const res = await admin.get('/store/v1/website').query({ code: testCode });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ name: 'Logo Test Site', logoUrl: null });
    });

    it('returns a live-presigned logoUrl once a logo is set', async () => {
      await prisma.website.update({ where: { code: testCode }, data: { logoMediaKey: 'website-logos/test-logo.png' } });
      const res = await admin.get('/store/v1/website').query({ code: testCode });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Logo Test Site');
      expect(res.body.data.logoUrl).toEqual(expect.stringContaining('website-logos/test-logo.png'));
    });
  });
});
