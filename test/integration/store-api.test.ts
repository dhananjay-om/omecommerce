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

  const testCodes = ['ZZT', 'ZZU', 'ZZV', 'ZZW'];

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
});
