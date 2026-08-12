import { NextResponse } from 'next/server';
import { apiGet, buildQuery, ApiError } from '@/lib/api-client';
import { STORE_VIEW_ID } from '@/lib/config';
import type { ProductDetail } from '@/types/product';

/**
 * Proxies the public store PDP lookup for Client Components — used by the
 * Recently Viewed section, which reads product ids out of localStorage (a
 * plain browser API, so this section can't be a Server Component like the
 * rest of the PDP). The underlying data is public/unauthenticated either
 * way; this just keeps the same-origin /api/* convention every other
 * Client-Component fetch in this app already follows.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const product = await apiGet<ProductDetail>(`/store/v1/products/${id}${buildQuery({ storeViewId: STORE_VIEW_ID })}`);
    return NextResponse.json(product);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
