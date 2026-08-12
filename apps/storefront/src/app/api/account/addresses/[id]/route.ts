import { NextResponse } from 'next/server';
import { apiDelete, ApiError } from '@/lib/api-client';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await apiDelete(`/store/v1/me/addresses/${id}`, { auth: true });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
