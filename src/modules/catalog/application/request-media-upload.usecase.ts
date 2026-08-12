import { randomUUID } from 'node:crypto';
import type { MediaStorage } from '../domain/repositories.js';
import type { RequestMediaUploadCommand, RequestMediaUploadResult } from './dto.js';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Step 1 of the direct-to-storage upload flow (plan/13 Phase J): mints a storage key and a short-lived presigned PUT URL the browser uploads bytes to directly, never through this server. */
export class RequestMediaUpload {
  constructor(private readonly storage: MediaStorage) {}

  async execute(cmd: RequestMediaUploadCommand): Promise<RequestMediaUploadResult> {
    const storageKey = `products/${randomUUID()}-${sanitizeFilename(cmd.filename)}`;
    const uploadUrl = await this.storage.presignPutUrl(storageKey, cmd.mimeType);
    return { uploadUrl, storageKey };
  }
}
