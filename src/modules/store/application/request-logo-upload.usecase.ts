import { randomUUID } from 'node:crypto';
import type { WebsiteRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { presignPutUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { RequestLogoUploadCommand, LogoUploadUrl } from './dto.js';

/** Same direct-to-storage 3-step pattern the catalog module's product-image
 *  upload already uses (request a presigned PUT URL -> browser PUTs directly
 *  to S3/MinIO, never proxied through this server -> confirm), simplified
 *  since a logo has no gallery/MediaAsset row to manage — "confirm" here is
 *  just the caller PATCHing the returned key onto Website.logoMediaKey via
 *  the existing tax-settings endpoint, no second new endpoint needed. */
export class RequestWebsiteLogoUpload {
  constructor(private readonly websites: WebsiteRepository) {}

  async execute(cmd: RequestLogoUploadCommand): Promise<LogoUploadUrl> {
    const existing = await this.websites.list();
    if (!existing.some((w) => w.code === cmd.code)) throw new NotFoundError('Website', cmd.code);

    const sanitizedFilename = cmd.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const logoMediaKey = `website-logos/${cmd.code}-${randomUUID()}-${sanitizedFilename}`;
    const uploadUrl = await presignPutUrl(logoMediaKey, cmd.mimeType);
    return { uploadUrl, logoMediaKey };
  }
}
