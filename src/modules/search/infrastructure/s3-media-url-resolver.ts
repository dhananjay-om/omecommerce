import type { MediaUrlResolver } from '../domain/ports.js';
import { presignGetUrl } from '../../../shared/infrastructure/storage/s3-client.js';

/** Thin adapter over the shared S3 client module, mirroring catalog's S3MediaStorage but read-only. */
export class S3MediaUrlResolver implements MediaUrlResolver {
  presignGetUrl(key: string): Promise<string> {
    return presignGetUrl(key);
  }
}
