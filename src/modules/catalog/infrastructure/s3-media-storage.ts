import type { MediaStorage } from '../domain/repositories.js';
import { presignPutUrl, presignGetUrl, deleteObject } from '../../../shared/infrastructure/storage/s3-client.js';

/** Thin adapter over the shared S3 client module, so use-cases depend on the `MediaStorage` port rather than the module directly. */
export class S3MediaStorage implements MediaStorage {
  presignPutUrl(key: string, contentType: string): Promise<string> {
    return presignPutUrl(key, contentType);
  }

  presignGetUrl(key: string): Promise<string> {
    return presignGetUrl(key);
  }

  deleteObject(key: string): Promise<void> {
    return deleteObject(key);
  }
}
