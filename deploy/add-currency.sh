#!/usr/bin/env bash
# Registers a new currency so price lists (and anything else scoped by
# currency) can actually use it — the `currency` table only ever gets USD
# seeded into it (prisma/seed.ts), and there's no admin UI to add more yet.
# Run from the repo root:
#   git pull && ./deploy/add-currency.sh
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

read -rp "Currency code (3 letters, e.g. INR): " CODE
read -rp "Symbol (e.g. ₹): " SYMBOL
read -rp "Name (e.g. Indian Rupee): " NAME
read -rp "Minor units [2]: " MINOR_UNITS
MINOR_UNITS="${MINOR_UNITS:-2}"

$COMPOSE exec \
  -e CUR_CODE="$CODE" \
  -e CUR_SYMBOL="$SYMBOL" \
  -e CUR_NAME="$NAME" \
  -e CUR_MINOR_UNITS="$MINOR_UNITS" \
  api node -e '
import("@prisma/client").then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient();
  const code = process.env.CUR_CODE.trim().toUpperCase();
  const row = await prisma.currency.upsert({
    where: { code },
    update: { symbol: process.env.CUR_SYMBOL, name: process.env.CUR_NAME, minorUnits: Number(process.env.CUR_MINOR_UNITS) },
    create: { code, symbol: process.env.CUR_SYMBOL, name: process.env.CUR_NAME, minorUnits: Number(process.env.CUR_MINOR_UNITS) },
  });
  console.log("Registered:", JSON.stringify(row));
  await prisma.$disconnect();
}).catch((err) => { console.error(err); process.exit(1); });
'

echo "Done. Try creating the price list again with currency=$CODE."
