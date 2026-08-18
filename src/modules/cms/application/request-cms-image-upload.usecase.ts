import { randomUUID } from 'node:crypto';
import { presignPutUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { RequestCmsImageUploadCommand, CmsImageUploadUrl } from './dto.js';

/**
 * Direct-to-storage upload for images embedded inline in a Page/Block body
 * via the rich text editor — own copy of the same presign-PUT pattern as
 * RequestBannerImageUpload/RequestCategoryImageUpload, deliberately not the
 * catalog module's `/media/uploads` (that one mints `products/`-prefixed
 * keys and is gated behind `catalog:manage`, not `cms:manage` — the wrong
 * namespace and the wrong permission for this).
 *
 * `imageUrl` here is a one-time presigned GET, good only long enough for
 * the editor to show an immediate preview right after upload — it is
 * NEVER what gets saved into the page/block body. The body only ever
 * stores the raw `imageMediaKey` (as the img tag's `data-media-key`
 * attribute), and resolve-inline-images.ts re-presigns a fresh URL from
 * that key on every read, so the embedded image never goes stale.
 */
export class RequestCmsImageUpload {
  async execute(cmd: RequestCmsImageUploadCommand): Promise<CmsImageUploadUrl> {
    const sanitizedFilename = cmd.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const imageMediaKey = `cms-images/${randomUUID()}-${sanitizedFilename}`;
    const uploadUrl = await presignPutUrl(imageMediaKey, cmd.mimeType);
    return { uploadUrl, imageMediaKey };
  }
}
