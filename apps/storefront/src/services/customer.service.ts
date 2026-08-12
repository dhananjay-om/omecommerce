import { api } from '@/lib/axios';
import type { SessionInfo } from '@/types/customer';

/** Client Component mutations only — via same-origin /api/auth + /api/session Route Handlers. */
export async function login(email: string, password: string): Promise<void> {
  await api.post('/auth/login', { email, password });
}

export async function register(input: { email: string; password: string; firstName?: string; lastName?: string }): Promise<void> {
  await api.post('/auth/register', input);
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function getSessionInfo(): Promise<SessionInfo> {
  const res = await api.get<SessionInfo>('/session');
  return res.data;
}
