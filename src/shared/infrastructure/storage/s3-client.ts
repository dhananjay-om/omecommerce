import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../../config/env.js';

/** Long enough for a single upload/read round-trip; short enough not to be a standing credential leak. */
const PRESIGN_EXPIRY_SECONDS = 900;

interface StorageConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

function requireConfig(): StorageConfig {
  const { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET } = env;
  if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET) {
    throw new Error('Media upload requires S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_BUCKET to be configured.');
  }
  return { endpoint: S3_ENDPOINT, accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY, bucket: S3_BUCKET };
}

let cached: { client: S3Client; bucket: string } | undefined;

/**
 * Lazily built, cached client — constructed on first real use rather than at
 * module load, so the rest of the app still boots fine when S3_* env vars are
 * unset (they're optional in config/env.ts; only the media endpoints need
 * them). Works against any S3-compatible endpoint, not just MinIO — same SDK
 * would point at real AWS S3 in production.
 */
function getClient(): { client: S3Client; bucket: string } {
  if (!cached) {
    const config = requireConfig();
    cached = {
      client: new S3Client({
        endpoint: config.endpoint,
        region: 'us-east-1', // ignored by MinIO; the SDK still requires a value
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
        forcePathStyle: true, // required for MinIO and any other non-AWS S3-compatible endpoint
      }),
      bucket: config.bucket,
    };
  }
  return cached;
}

/** A presigned URL the browser PUTs the file bytes to directly — never proxied through this server. */
export function presignPutUrl(key: string, contentType: string): Promise<string> {
  const { client, bucket } = getClient();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });
}

/** A presigned URL for reading an object — generated per-request so no bucket ACL/public access is needed. */
export function presignGetUrl(key: string): Promise<string> {
  const { client, bucket } = getClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: PRESIGN_EXPIRY_SECONDS });
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Server-side direct write — distinct from presignPutUrl (a URL the browser
 * PUTs to directly). Used for content the backend itself generates (e.g. a
 * Puppeteer-rendered invoice PDF, plan/15 Phase 1), which never touches the
 * client before it's stored.
 */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { client, bucket } = getClient();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}
