import type { Express } from 'express';
import request from 'supertest';

/** Matches the dev admin seeded in prisma/seed.ts (RBAC: super-admin, all permissions). */
export const DEV_ADMIN_EMAIL = 'admin@ome.local';
export const DEV_ADMIN_PASSWORD = 'dev-only-password-change-me';

/** Logs in as the seeded dev admin and returns a bearer token for admin API calls. */
export async function getAdminToken(app: Express): Promise<string> {
  const res = await request(app)
    .post('/admin/v1/auth/login')
    .send({ email: DEV_ADMIN_EMAIL, password: DEV_ADMIN_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`test setup: admin login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data.token as string;
}

/**
 * A `request(app)`-like wrapper whose get/post/put/delete calls automatically
 * carry the admin bearer token — avoids repeating `.set('Authorization', ...)`
 * on every one of the many /admin/v1 calls across the integration suite.
 */
export function adminRequest(app: Express, token: string) {
  const withAuth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  return {
    get: (url: string) => withAuth(request(app).get(url)),
    post: (url: string) => withAuth(request(app).post(url)),
    put: (url: string) => withAuth(request(app).put(url)),
    delete: (url: string) => withAuth(request(app).delete(url)),
  };
}
