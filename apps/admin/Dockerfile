# Multi-stage build for the OMEcommerce admin frontend (Next.js, standalone output).
# Build context must be the REPO ROOT (not apps/admin) so this can COPY just
# this app's folder without dragging in the backend or the storefront —
# see docker-compose.prod.yml's `build.context: .` / `dockerfile: apps/admin/Dockerfile`.
# Pinned to node:24 (not 22, unlike the backend's Dockerfile) to match the
# npm version (11.x) this app's package-lock.json was generated with locally.
FROM node:24-slim AS base
WORKDIR /app

FROM base AS deps
COPY apps/admin/package.json apps/admin/package-lock.json* ./
# `npm install`, not `npm ci`: this lockfile's platform-optional-dependency
# entries (Tailwind v4's native/WASM oxide bindings, via @unrs/resolver-*)
# don't round-trip cleanly through `npm ci`'s stricter sync check even right
# after a fresh `npm install --package-lock-only` — confirmed by actually
# building this image. `npm install` resolves the same tree without that
# check.
RUN npm install --no-audit --no-fund

FROM deps AS build
COPY apps/admin/ .
# API_BASE_URL is read at request time (Server Components call it per-request),
# not inlined at build time — no NEXT_PUBLIC_ build args needed here.
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# `output: 'standalone'` (next.config.ts) traces only the files this app
# actually needs — no full node_modules copy required.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
