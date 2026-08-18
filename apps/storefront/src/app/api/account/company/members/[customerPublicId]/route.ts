import { NextResponse } from 'next/server';
import { apiPut, apiDelete, ApiError } from '@/lib/api-client';
import type { CompanyMember } from '@/types/company';

export async function PUT(request: Request, { params }: { params: Promise<{ customerPublicId: string }> }) {
  const { customerPublicId } = await params;
  const body = await request.json().catch(() => null);
  try {
    const member = await apiPut<CompanyMember>(`/store/v1/me/company/members/${customerPublicId}`, body, { auth: true });
    return NextResponse.json(member);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ customerPublicId: string }> }) {
  const { customerPublicId } = await params;
  try {
    await apiDelete(`/store/v1/me/company/members/${customerPublicId}`, { auth: true });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
