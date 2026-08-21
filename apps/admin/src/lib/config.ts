import 'server-only';

/**
 * Server-only: not `NEXT_PUBLIC_`-prefixed, same "silently wrong from a
 * Client Component without this guard" reasoning as the storefront's own
 * lib/config.ts — the value must be passed down as a prop from a Server
 * Component (see layout.tsx -> TopHeader, and the product edit page's own
 * "View on Storefront" link) rather than read directly from a 'use client'
 * file.
 */
export const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3001';
