import type { BannerGroup } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { BannerRepository, BannerRecord, CreateBannerInput, UpdateBannerInput } from '../domain/repositories.js';

const BANNER_SELECT = {
  publicId: true,
  group: true,
  title: true,
  subtitle: true,
  imageMediaKey: true,
  ctaLabel: true,
  ctaHref: true,
  gradient: true,
  position: true,
  isActive: true,
  updatedAt: true,
} as const;

export class PrismaBannerRepository implements BannerRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateBannerInput): Promise<BannerRecord> {
    return this.db.banner.create({
      data: {
        group: input.group,
        title: input.title,
        subtitle: input.subtitle,
        imageMediaKey: input.imageMediaKey,
        ctaLabel: input.ctaLabel,
        ctaHref: input.ctaHref,
        gradient: input.gradient,
        position: input.position,
        isActive: input.isActive,
      },
      select: BANNER_SELECT,
    });
  }

  async findByPublicId(publicId: string): Promise<BannerRecord | null> {
    return this.db.banner.findFirst({ where: { publicId, deletedAt: null }, select: BANNER_SELECT });
  }

  async list(): Promise<BannerRecord[]> {
    return this.db.banner.findMany({ where: { deletedAt: null }, select: BANNER_SELECT, orderBy: { updatedAt: 'desc' } });
  }

  async listActiveByGroup(group: BannerGroup): Promise<BannerRecord[]> {
    return this.db.banner.findMany({
      where: { group, isActive: true, deletedAt: null },
      select: BANNER_SELECT,
      orderBy: { position: 'asc' },
    });
  }

  async update(publicId: string, input: UpdateBannerInput): Promise<BannerRecord> {
    return this.db.banner.update({
      where: { publicId },
      data: {
        title: input.title,
        subtitle: input.subtitle,
        imageMediaKey: input.imageMediaKey,
        ctaLabel: input.ctaLabel,
        ctaHref: input.ctaHref,
        gradient: input.gradient,
        position: input.position,
        isActive: input.isActive,
      },
      select: BANNER_SELECT,
    });
  }

  async softDelete(publicId: string): Promise<void> {
    await this.db.banner.update({ where: { publicId }, data: { deletedAt: new Date() } });
  }
}
