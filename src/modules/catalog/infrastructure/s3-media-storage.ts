import type { MediaStorage } from '../domain/repositories.js';
import { presignPutUrl, presignGetUrl, deleteObject, putObject } from '../../../shared/infrastructure/storage/s3-client.js';

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

  putObjectFromBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
    return putObject(key, buffer, contentType);
  }
}
