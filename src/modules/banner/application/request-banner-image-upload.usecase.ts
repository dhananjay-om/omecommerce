import { randomUUID } from 'node:crypto';
import { presignPutUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { RequestBannerImageUploadCommand, BannerImageUploadUrl } from './dto.js';

/** Same direct-to-storage 3-step pattern as RequestCategoryImageUpload —
 *  simpler still, since a banner has no existing-entity lookup to do first
 *  (the create form itself uploads an image before any Banner row exists,
 *  unlike Category where the image field only appears once the row is
 *  already there). */
export class RequestBannerImageUpload {
  async execute(cmd: RequestBannerImageUploadCommand): Promise<BannerImageUploadUrl> {
    const sanitizedFilename = cmd.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const imageMediaKey = `banner-images/${cmd.group.toLowerCase()}-${randomUUID()}-${sanitizedFilename}`;
    const uploadUrl = await presignPutUrl(imageMediaKey, cmd.mimeType);
    return { uploadUrl, imageMediaKey };
  }
}
