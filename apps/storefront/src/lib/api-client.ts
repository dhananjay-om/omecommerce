import 'server-only';
import { getSession } from './session';

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

interface RequestOpts {
  /** Attach the customer's bearer token if a session exists — most storefront reads are public and omit this (unlike admin, where every fetch requires it). */
  auth?: boolean;
}

async function request<T>(path: string, init: RequestInit, opts?: RequestOpts): Promise<T> {
  const headers: Record<string, string> = init.body ? { 'Content-Type': 'application/json' } : {};
  if (opts?.auth) {
    const token = await getSession();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store', // storefront data (price/stock/cart) is never stale-tolerant at this layer; page-level caching is a separate, later concern
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

export function apiGet<T>(path: string, opts?: RequestOpts): Promise<T> {
  return request<T>(path, { method: 'GET' }, opts);
}

export function apiPost<T>(path: string, body?: unknown, opts?: RequestOpts): Promise<T> {
  return request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }, opts);
}

export function apiPut<T>(path: string, body?: unknown, opts?: RequestOpts): Promise<T> {
  return request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }, opts);
}

export function apiPatch<T>(path: string, body?: unknown, opts?: RequestOpts): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }, opts);
}

export function apiDelete<T>(path: string, opts?: RequestOpts): Promise<T> {
  return request<T>(path, { method: 'DELETE' }, opts);
}
