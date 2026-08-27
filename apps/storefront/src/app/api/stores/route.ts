import { NextResponse } from 'next/server';
import { getPublicStores } from '@/lib/store-context';
import { ApiError } from '@/lib/api-client';

/** Client-Component fetch for the store switcher — the switcher itself
 *  receives the list as a prop from its Server Component parent normally
 *  (avoids a client waterfall), this exists for any client code that needs
 *  to re-fetch it standalone, same same-origin /api/* convention as every
 *  other Client-Component read in this app. */
export async function GET() {
  try {
    const stores = await getPublicStores();
    return NextResponse.json(stores);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
