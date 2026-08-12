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
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
