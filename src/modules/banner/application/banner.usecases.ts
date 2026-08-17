import type { BannerRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toBannerView } from './banner-view.js';
import type { CreateBannerCommand, UpdateBannerCommand, BannerView } from './dto.js';

export class CreateBanner {
  constructor(private readonly banners: BannerRepository) {}

  async execute(cmd: CreateBannerCommand): Promise<BannerView> {
    const banner = await this.banners.create(cmd);
    return toBannerView(banner);
  }
}

export class UpdateBanner {
  constructor(private readonly banners: BannerRepository) {}

  async execute(cmd: UpdateBannerCommand): Promise<BannerView> {
    if (!(await this.banners.findByPublicId(cmd.publicId))) {
      throw new NotFoundError('banner', cmd.publicId);
    }
    const banner = await this.banners.update(cmd.publicId, cmd);
    return toBannerView(banner);
  }
}

/** Admin browse (Content > Banners). */
export class ListBanners {
  constructor(private readonly banners: BannerRepository) {}

  async execute(): Promise<BannerView[]> {
    const rows = await this.banners.list();
    return Promise.all(rows.map(toBannerView));
  }
}

export class GetBannerByPublicId {
  constructor(private readonly banners: BannerRepository) {}

  async execute(publicId: string): Promise<BannerView> {
    const banner = await this.banners.findByPublicId(publicId);
    if (!banner) throw new NotFoundError('banner', publicId);
    return toBannerView(banner);
  }
}

export class DeleteBanner {
  constructor(private readonly banners: BannerRepository) {}

  async execute(publicId: string): Promise<void> {
    if (!(await this.banners.findByPublicId(publicId))) {
      throw new NotFoundError('banner', publicId);
    }
    await this.banners.softDelete(publicId);
  }
}
