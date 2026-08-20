#!/usr/bin/env bash
# Sets the store's actual OPERATING currency (Website.baseCurrency + every
# StoreView.currency) — the field formatPrice() on the storefront actually
# reads to decide $ vs ₹ vs whatever. This is DIFFERENT from Stores >
# Currencies "Set as Default" in the admin app, which only flips a registry
# flag on the `currency` table and never touches these fields — there's no
# admin UI for this yet (see src/modules/store/store.module.ts's own header
# comment: "full Website/Store View management is a deliberate later
# addition, not built here").
#
# The target currency must be registered first (Stores > Currency Setup, or
# deploy/add-currency.sh) — this script upserts it defensively anyway so it
# works standalone too.
#
# Run from the repo root:
#   git pull && ./deploy/set-store-currency.sh
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

read -rp "Currency code to switch the store to (3 letters) [INR]: " CODE
CODE="${CODE:-INR}"
read -rp "Symbol (only used if this currency isn't registered yet) [₹]: " SYMBOL
SYMBOL="${SYMBOL:-₹}"
read -rp "Name (only used if this currency isn't registered yet) [Indian Rupee]: " NAME
NAME="${NAME:-Indian Rupee}"
read -rp "Website code [us_retail]: " WEBSITE_CODE
WEBSITE_CODE="${WEBSITE_CODE:-us_retail}"

$COMPOSE exec \
  -e CUR_CODE="$CODE" \
  -e CUR_SYMBOL="$SYMBOL" \
  -e CUR_NAME="$NAME" \
  -e SITE_CODE="$WEBSITE_CODE" \
  api node -e '
import("@prisma/client").then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient();
  const code = process.env.CUR_CODE.trim().toUpperCase();

  await prisma.currency.upsert({
    where: { code },
    update: {},
    create: { code, symbol: process.env.CUR_SYMBOL, name: process.env.CUR_NAME, minorUnits: 2 },
  });

  const before = {
    website: await prisma.website.findMany({ select: { code: true, baseCurrency: true } }),
    storeViews: await prisma.storeView.findMany({ select: { code: true, currency: true } }),
  };
  console.log("BEFORE:", JSON.stringify(before));

  const w = await prisma.website.updateMany({ where: { code: process.env.SITE_CODE }, data: { baseCurrency: code } });
  const sv = await prisma.storeView.updateMany({ data: { currency: code } });

  const after = {
    website: await prisma.website.findMany({ select: { code: true, baseCurrency: true } }),
    storeViews: await prisma.storeView.findMany({ select: { code: true, currency: true } }),
  };
  console.log("AFTER:", JSON.stringify(after));
  console.log(`Updated ${w.count} website(s) and ${sv.count} store view(s) to ${code}.`);
  await prisma.$disconnect();
}).catch((err) => { console.error(err); process.exit(1); });
'

echo "Done. Reload the storefront — prices should now show in $CODE."
echo "Note: any existing price lists priced only in the old currency won't show"
echo "a price until you add prices in $CODE too (Stores > Pricing)."
