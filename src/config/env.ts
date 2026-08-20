import 'dotenv/config';
import { z } from 'zod';

/**
 * 12-factor config: validate the environment once at boot and fail fast.
 * See plan/09-deployment-architecture.md §7.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  OPENSEARCH_URL: z.string().url().default('http://localhost:9200'),
  S3_ENDPOINT: z.string().url().optional(),
  // Presigned PUT/GET URLs are meant for the BROWSER to hit directly (never
  // proxied through this server) — but S3_ENDPOINT is typically an
  // internal-only Docker network address (e.g. http://minio:9000), which no
  // browser outside that network can resolve. When set, S3_PUBLIC_ENDPOINT
  // is used instead, ONLY for presigning URLs that get returned to
  // clients; S3_ENDPOINT keeps being used for the server's own direct
  // reads/writes (e.g. generated PDFs), where internal networking is both
  // fine and faster. Falls back to S3_ENDPOINT when unset, matching prior
  // behavior for local dev where MinIO is already directly reachable.
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  // A dedicated secret, not reused JWT_SECRET — this is a different
  // cryptographic purpose (deterministic keyed hash for exact-match code
  // lookup, not signature verification), so a separate key is the cleaner
  // practice (unlike the customer-token/JWT_SECRET reuse decision, which was
  // justified by a payload-shape check being the real boundary there).
  GIFT_CARD_HMAC_SECRET: z.string().min(16, 'GIFT_CARD_HMAC_SECRET must be at least 16 characters'),
  // Order transactional email (plan/15 Phase 3 originally shipped only a
  // SimulatedEmailSender — logs, never actually sends — since no provider
  // credentials existed yet). All optional, same "absent = fall back to the
  // simulated adapter" precedent as S3_*: SMTP_USER/SMTP_PASS are the real
  // gate (see order.module.ts's createEmailSender), the rest default to
  // Gmail/Google Workspace's own published SMTP settings so a Google
  // Workspace account only has to supply the address + an App Password
  // (Google requires one for SMTP — a normal account password is rejected).
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Shown as the "From" address/name — defaults to SMTP_USER (the
  // authenticated account) when unset, which is also the only address Gmail
  // SMTP will accept in "From" without extra "Send As" configuration.
  SMTP_FROM: z.string().optional(),
  // The storefront's own public URL — already set on the storefront service
  // itself (docker-compose.prod.yml, for metadataBase/OpenGraph/sitemap);
  // the API needs its own copy too, only for building a clickable "View
  // Order Details" / storefront link inside a transactional email. Optional
  // — a missing value just means that link is omitted, not a boot failure.
  SITE_URL: z.string().url().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
