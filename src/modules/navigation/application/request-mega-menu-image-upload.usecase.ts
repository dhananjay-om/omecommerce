import { randomUUID } from 'node:crypto';
import { presignPutUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { RequestMegaMenuImageUploadCommand, MegaMenuImageUploadUrl } from './dto.js';

/** Same direct-to-storage 3-step pattern as RequestBannerImageUpload — no
 *  existing MegaMenuItem row is required first (the create form itself
 *  can upload before Create is clicked). */
export class RequestMegaMenuImageUpload {
  async execute(cmd: RequestMegaMenuImageUploadCommand): Promise<MegaMenuImageUploadUrl> {
    const sanitizedFilename = cmd.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const imageMediaKey = `mega-menu-images/${randomUUID()}-${sanitizedFilename}`;
    const uploadUrl = await presignPutUrl(imageMediaKey, cmd.mimeType);
    return { uploadUrl, imageMediaKey };
  }
}
