import 'server-only';
import { requireSession } from './session';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4100';

/** Mirrors the backend's RFC 9457 problem+json error shape (every module returns this consistently). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly type?: string,
    public readonly errors?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Builds a query string, skipping undefined/empty values. */
export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/**
 * The actual auth-enforcement point for every page/action that reads or
 * writes admin data — calls requireSession() itself rather than relying on
 * a shared layout to have already checked (see session.ts's header comment
 * on why: layouts don't re-run on client-side navigation in this Next.js
 * version, so the check has to live at the data-fetching call site).
 */
async function request<T>(path: string, init: RequestInit): Promise<T> {
  const token = await requireSession();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store', // admin data is never stale-tolerant
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, body?.title ?? `Request failed with status ${res.status}`, body?.type, body?.errors);
  }

  return (body?.data ?? body) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}
