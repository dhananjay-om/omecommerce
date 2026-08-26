import { randomUUID } from 'node:crypto';
import type { MediaStorage } from '../domain/repositories.js';
import type { RequestMediaUploadCommand, RequestMediaUploadResult } from './dto.js';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Own copy of RequestMediaUpload's presign-PUT pattern, deliberately not
 *  reused directly — that one mints `products/`-prefixed keys behind
 *  `catalog:manage` (admin-only); this one is customer-facing (gated
 *  `requireCustomer`, not an admin permission — see catalog.module.ts's
 *  `/reviews/uploads` route) and mints its own `reviews/`-prefixed keys
 *  so the two lifecycles stay distinguishable. Same "own trivial copy"
 *  precedent as RequestCmsImageUpload. */
export class RequestReviewImageUpload {
  constructor(private readonly storage: MediaStorage) {}

  async execute(cmd: RequestMediaUploadCommand): Promise<RequestMediaUploadResult> {
    const storageKey = `reviews/${randomUUID()}-${sanitizeFilename(cmd.filename)}`;
    const uploadUrl = await this.storage.presignPutUrl(storageKey, cmd.mimeType);
    return { uploadUrl, storageKey };
  }
}
