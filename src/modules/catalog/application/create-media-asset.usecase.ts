import type { MediaKind } from '@prisma/client';
import type { MediaAssetRepository } from '../domain/repositories.js';
import type { CreateMediaAssetCommand, MediaAssetView } from './dto.js';

function inferKind(mimeType: string): MediaKind {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('model/')) return 'MODEL3D';
  return 'DOCUMENT';
}

/** Step 2 of the upload flow (plan/13 Phase J): registers the now-uploaded object as a MediaAsset row, once the browser's direct PUT to storage has completed. */
export class CreateMediaAsset {
  constructor(private readonly mediaAssets: MediaAssetRepository) {}

  async execute(cmd: CreateMediaAssetCommand): Promise<MediaAssetView> {
    const asset = await this.mediaAssets.create({
      storageKey: cmd.storageKey,
      mimeType: cmd.mimeType,
      bytes: BigInt(cmd.bytes),
      width: cmd.width,
      height: cmd.height,
      kind: inferKind(cmd.mimeType),
    });
    return { publicId: asset.publicId, mimeType: asset.mimeType, kind: asset.kind };
  }
}
