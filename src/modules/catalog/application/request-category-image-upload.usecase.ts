import { randomUUID } from 'node:crypto';
import type { CategoryRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { presignPutUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { RequestCategoryImageUploadCommand, CategoryImageUploadUrl } from './dto.js';

/** Same direct-to-storage 3-step pattern as the store module's
 *  RequestWebsiteLogoUpload (request a presigned PUT URL -> browser PUTs
 *  directly to S3/MinIO, never proxied through this server -> confirm),
 *  simplified since a category image has no gallery/MediaAsset row to
 *  manage — "confirm" here is just the caller submitting the returned key
 *  alongside the rest of the edit form via the existing update endpoint. */
export class RequestCategoryImageUpload {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(cmd: RequestCategoryImageUploadCommand): Promise<CategoryImageUploadUrl> {
    const category = await this.categories.findByPublicId(cmd.publicId);
    if (!category) throw new NotFoundError('category', cmd.publicId);

    const sanitizedFilename = cmd.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const imageMediaKey = `category-images/${category.slug}-${randomUUID()}-${sanitizedFilename}`;
    const uploadUrl = await presignPutUrl(imageMediaKey, cmd.mimeType);
    return { uploadUrl, imageMediaKey };
  }
}
