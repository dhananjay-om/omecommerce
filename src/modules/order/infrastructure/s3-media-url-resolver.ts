import type { MediaUrlResolver } from '../domain/ports.js';
import { presignGetUrl } from '../../../shared/infrastructure/storage/s3-client.js';

/** Own copy of search's identical S3MediaUrlResolver (per-module lookup convention) — thin adapter over the shared S3 client module. */
export class S3MediaUrlResolver implements MediaUrlResolver {
  presignGetUrl(key: string): Promise<string> {
    return presignGetUrl(key);
  }
}
