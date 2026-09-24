import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import { getSelectedWebsiteCode } from '@/lib/store-context';

// Soft per-visitor limit so the public form can't be used to spray welcome
// emails at other people's addresses. In-memory (per server process) — a
// light guard, not a security boundary.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function tooMany(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return false;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const source = typeof body?.source === 'string' ? body.source : 'home';
  // Hidden "website" field real visitors never fill in — bots that fill every
  // input get a silent success and nothing is stored.
  if (typeof body?.website === 'string' && body.website !== '') return NextResponse.json({ ok: true });
  if (!email) return NextResponse.json({ error: 'Please enter your email address.' }, { status: 400 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  if (tooMany(ip)) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });

  try {
    await apiPost('/store/v1/newsletter/subscribe', { email, source, websiteCode: await getSelectedWebsiteCode() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      const message = err.status === 422 ? 'Please enter a valid email address.' : 'Could not subscribe right now. Please try again.';
      return NextResponse.json({ error: message }, { status: err.status === 422 ? 422 : 502 });
    }
    throw err;
  }
}
