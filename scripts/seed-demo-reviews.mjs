#!/usr/bin/env node
// Seeds a handful of realistic customer reviews for a few of the demo
// products (scripts/seed-demo-data.mjs) — real text the AI Product
// Assistant's "Summarize with AI" (Reviews tab) has something genuine to
// read. No admin endpoint creates reviews (see ProductReview's own schema
// doc comment — there's deliberately no submission/moderation flow in this
// system), so this writes directly via Prisma, same pattern seed-demo-
// data.mjs already uses for its one no-endpoint write.
//
// Idempotent: skips a product that already has any reviews.
//
// Usage: node scripts/seed-demo-reviews.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REVIEWS_BY_SKU = {
  'DEMO-TSHIRT': [
    { customerName: 'Priya S.', rating: 5, title: 'Great everyday tee', body: 'Soft, fits true to size, holds up well after several washes. Bought a second one in a different color.' },
    { customerName: 'Arjun M.', rating: 4, title: null, body: 'Good quality for the price. A bit thinner than I expected but still comfortable.' },
    { customerName: 'Kavya R.', rating: 2, title: 'Ran small', body: 'Ordered my usual size and it was noticeably tight. Fabric feels nice though.' },
  ],
  'DEMO-COFFEE-MAKER': [
    { customerName: 'Rahul D.', rating: 5, title: 'Makes great coffee', body: "Simple to use, brews fast, and the coffee actually tastes good. No complaints after a month of daily use." },
    { customerName: 'Sneha K.', rating: 5, title: null, body: 'Compact enough for my small kitchen counter. Easy to clean too.' },
    { customerName: 'Vikram T.', rating: 3, title: 'Decent but loud', body: "Works fine but it's louder than my old machine. Coffee quality is good though." },
  ],
  'DEMO-LAPTOP-AIR-13': [
    { customerName: 'Ananya P.', rating: 4, title: 'Light and fast', body: 'Battery lasts most of the day for regular work. Wish it had more ports but overall happy with it.' },
    { customerName: 'Karthik B.', rating: 5, title: 'Perfect for travel', body: "Exactly what I needed for work trips — light, boots up fast, screen is crisp." },
  ],
  'DEMO-PHONE-X1': [
    { customerName: 'Meera J.', rating: 5, title: 'Camera is excellent', body: 'Photos come out sharp even in low light. Battery easily lasts a full day of heavy use.' },
    { customerName: 'Aditya N.', rating: 3, title: 'Good phone, gets warm', body: 'Performance is solid for gaming but it heats up after 30+ minutes. Otherwise a good upgrade from my old phone.' },
  ],
};

let seeded = 0;
let skipped = 0;
for (const [sku, reviews] of Object.entries(REVIEWS_BY_SKU)) {
  const product = await prisma.product.findFirst({ where: { sku, deletedAt: null }, select: { id: true } });
  if (!product) {
    console.log(`skip ${sku}: product not found (run seed-demo-data.mjs first)`);
    continue;
  }
  const existing = await prisma.productReview.count({ where: { productId: product.id } });
  if (existing > 0) {
    console.log(`skip ${sku}: already has ${existing} review(s)`);
    skipped++;
    continue;
  }
  await prisma.productReview.createMany({
    // isApproved: true — these are demo fixture reviews (no real customer,
    // no submission flow behind them), meant to show up immediately, not
    // sit in the real moderation queue real customer submissions now go
    // through (see ProductReview's own schema doc comment).
    data: reviews.map((r) => ({ productId: product.id, customerName: r.customerName, rating: r.rating, title: r.title, body: r.body, isApproved: true })),
  });
  console.log(`seeded ${reviews.length} reviews for ${sku}`);
  seeded++;
}

console.log(`done. seeded ${seeded} product(s), skipped ${skipped} already-seeded product(s).`);
await prisma.$disconnect();
