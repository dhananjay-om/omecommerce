import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app has its own lockfile, but sibling lockfiles exist higher up
  // (the backend's, and an unrelated one in the user's home directory) —
  // pin the root explicitly so Turbopack doesn't guess wrong.
  turbopack: {
    root: path.join(import.meta.dirname),
  },
  // Same multi-lockfile ambiguity applies to the production build's file
  // tracer (used by `output: 'standalone'`) as to Turbopack above — pin it
  // explicitly rather than letting Next guess the wrong monorepo root.
  outputFileTracingRoot: path.join(import.meta.dirname),
  // Minimal self-contained `.next/standalone` output (server.js + only the
  // node_modules files actually traced as needed) — keeps the production
  // Docker image small instead of shipping the full node_modules tree.
  output: 'standalone',
  // Single-domain deploy: the storefront serves the domain root and this
  // app is reverse-proxied at /admin (see deploy/Caddyfile) — basePath makes
  // Next itself prefix every internal Link/redirect/router.push call, API
  // route, and /_next/* static asset URL with /admin, so none of the ~15
  // root-relative hrefs/redirects already in this app's source needed to
  // change. Leave unset (or override via NEXT_BASE_PATH if ever needed) for
  // a deployment that instead puts admin on its own subdomain at the root.
  basePath: '/admin',
};

export default nextConfig;
