import { NextResponse } from 'next/server';
import { apiGet, apiPost, ApiError } from '@/lib/api-client';
import type { CompanyMember } from '@/types/company';

/** GET/POST only meaningful for an ADMIN-role member — the backend 403s a BUYER attempting either. */
export async function GET() {
  const members = await apiGet<CompanyMember[]>('/store/v1/me/company/members', { auth: true });
  return NextResponse.json(members);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    const member = await apiPost<CompanyMember>('/store/v1/me/company/members', body, { auth: true });
    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
