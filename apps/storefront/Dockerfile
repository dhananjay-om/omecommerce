# Multi-stage build for the OMEcommerce storefront frontend (Next.js, standalone output).
# Build context must be the REPO ROOT (not apps/storefront) — see
# docker-compose.prod.yml's `build.context: .` / `dockerfile: apps/storefront/Dockerfile`.
# Pinned to node:24 (not 22, unlike the backend's Dockerfile) to match the
# npm version (11.x) this app's package-lock.json was generated with locally.
FROM node:24-slim AS base
WORKDIR /app

FROM base AS deps
COPY apps/storefront/package.json apps/storefront/package-lock.json* ./
# `npm install`, not `npm ci`: this lockfile's platform-optional-dependency
# entries (Tailwind v4's native/WASM oxide bindings, via @unrs/resolver-*)
# don't round-trip cleanly through `npm ci`'s stricter sync check even right
# after a fresh `npm install --package-lock-only` — confirmed by actually
# building this image. `npm install` resolves the same tree without that
# check.
RUN npm install --no-audit --no-fund

FROM deps AS build
COPY apps/storefront/ .
# API_BASE_URL/WEBSITE_CODE/STORE_VIEW_ID are read at request time (Server
# Components + Route Handlers call the backend per-request), not inlined at
# build time — no NEXT_PUBLIC_ build args needed here.
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3001
CMD ["node", "server.js"]
