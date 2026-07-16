'use server';

import { redirect } from 'next/navigation';
import { createSession, destroySession } from '@/lib/session';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4100';

export interface LoginFormState {
  error: string | null;
}

export async function login(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const res = await fetch(`${API_BASE_URL}/admin/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return { error: body?.title ?? 'Login failed.' };
  }

  await createSession(body.data.token);
  redirect('/products');
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/login');
}
