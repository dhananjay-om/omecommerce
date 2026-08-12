import { NextResponse } from 'next/server';
import { apiGet, apiPost, ApiError } from '@/lib/api-client';
import type { CustomerAddress } from '@/types/customer';

export async function GET() {
  const addresses = await apiGet<CustomerAddress[]>('/store/v1/me/addresses', { auth: true });
  return NextResponse.json(addresses);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    const address = await apiPost<CustomerAddress>('/store/v1/me/addresses', body, { auth: true });
    return NextResponse.json(address, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
