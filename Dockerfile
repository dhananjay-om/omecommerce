# Multi-stage build for the OMEcommerce API (single-tenant deploy per client).
FROM node:22-slim AS base
WORKDIR /app
# `puppeteer` (used for invoice/packing-slip PDF rendering — see
# infrastructure/puppeteer-pdf-renderer.ts) is a production dependency whose
# own `npm install` postinstall tries to download a matching Chrome build,
# which fails here (`node:22-slim` has no `unzip` to extract it). Installing
# the distro's `chromium` package instead sidesteps that entirely: apt pulls
# in the correct shared-library closure automatically (far more reliable
# than hand-listing the ~20 libs headless Chrome needs), and the two ENV
# vars below tell puppeteer to skip its own download and use this binary —
# both confirmed by actually building and running this image, not assumed.
RUN apt-get update && apt-get install -y --no-install-recommends openssl chromium && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate --schema prisma/schema && npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# `npm run db:seed` runs `tsx prisma/seed.ts` directly (not the compiled
# dist/ output) — and prisma/seed.ts imports
# ../src/modules/auth/infrastructure/scrypt-password-hasher.js by a relative
# TS path, not from dist. Without src/ present, that import 404s at runtime
# with ERR_MODULE_NOT_FOUND — confirmed by actually running `db:seed`
# against this image, not just building it. dist/ stays the thing CMD
# actually runs; src/ only needs to be here for tsx-run scripts like this.
COPY --from=build /app/src ./src
# For scripts/seed-demo-data.mjs (run via `docker compose exec api node
# scripts/seed-demo-data.mjs`) — not needed by the app itself at runtime,
# but small, and simplest to just always have available.
COPY --from=build /app/scripts ./scripts
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
