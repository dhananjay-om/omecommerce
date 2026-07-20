import axios from 'axios';

/**
 * Client-Component-triggered mutations (add-to-cart, wishlist toggle, login
 * form submit) go through THIS — same-origin Next.js Route Handlers under
 * /api, never the Express backend directly. The customer's session token
 * lives only in an httpOnly cookie (see lib/session.ts), so client-side code
 * can never read or attach it itself; the Route Handlers do that server-side
 * and proxy to Express. Server Components/Actions bypass this entirely and
 * call lib/api-client.ts directly.
 */
export const api = axios.create({
  baseURL: '/api',
});
