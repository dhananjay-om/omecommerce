import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  MegaMenuItemRepository,
  MegaMenuItemRecord,
  MegaMenuColumn,
  MegaMenuPromoImagePosition,
  CreateMegaMenuItemInput,
  UpdateMegaMenuItemInput,
} from '../domain/repositories.js';

const MEGA_MENU_ITEM_SELECT = {
  publicId: true,
  label: true,
  href: true,
  position: true,
  isActive: true,
  columns: true,
  promoImageMediaKey: true,
  promoHref: true,
  promoCaption: true,
  panelWidth: true,
  columnGap: true,
  promoImageWidth: true,
  promoImageHeight: true,
  promoImagePosition: true,
  updatedAt: true,
} as const;

type Row = {
  publicId: string;
  label: string;
  href: string;
  position: number;
  isActive: boolean;
  columns: unknown;
  promoImageMediaKey: string | null;
  promoHref: string | null;
  promoCaption: string | null;
  panelWidth: number | null;
  columnGap: number | null;
  promoImageWidth: number | null;
  promoImageHeight: number | null;
  promoImagePosition: string;
  updatedAt: Date;
};

function toRecord(row: Row): MegaMenuItemRecord {
  return {
    ...row,
    columns: (row.columns ?? []) as MegaMenuColumn[],
    promoImagePosition: row.promoImagePosition as MegaMenuPromoImagePosition,
  };
}

export class PrismaMegaMenuItemRepository implements MegaMenuItemRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateMegaMenuItemInput): Promise<MegaMenuItemRecord> {
    const row = await this.db.megaMenuItem.create({
      data: {
        label: input.label,
        href: input.href,
        position: input.position,
        isActive: input.isActive,
        columns: (input.columns ?? []) as object,
        promoImageMediaKey: input.promoImageMediaKey,
        promoHref: input.promoHref,
        promoCaption: input.promoCaption,
        panelWidth: input.panelWidth,
        columnGap: input.columnGap,
        promoImageWidth: input.promoImageWidth,
        promoImageHeight: input.promoImageHeight,
        promoImagePosition: input.promoImagePosition,
      },
      select: MEGA_MENU_ITEM_SELECT,
    });
    return toRecord(row);
  }

  async findByPublicId(publicId: string): Promise<MegaMenuItemRecord | null> {
    const row = await this.db.megaMenuItem.findFirst({ where: { publicId, deletedAt: null }, select: MEGA_MENU_ITEM_SELECT });
    return row ? toRecord(row) : null;
  }

  async list(): Promise<MegaMenuItemRecord[]> {
    const rows = await this.db.megaMenuItem.findMany({ where: { deletedAt: null }, select: MEGA_MENU_ITEM_SELECT, orderBy: { position: 'asc' } });
    return rows.map(toRecord);
  }

  async listActive(): Promise<MegaMenuItemRecord[]> {
    const rows = await this.db.megaMenuItem.findMany({
      where: { isActive: true, deletedAt: null },
      select: MEGA_MENU_ITEM_SELECT,
      orderBy: { position: 'asc' },
    });
    return rows.map(toRecord);
  }

  async update(publicId: string, input: UpdateMegaMenuItemInput): Promise<MegaMenuItemRecord> {
    const row = await this.db.megaMenuItem.update({
      where: { publicId },
      data: {
        label: input.label,
        href: input.href,
        position: input.position,
        isActive: input.isActive,
        columns: input.columns !== undefined ? (input.columns as object) : undefined,
        promoImageMediaKey: input.promoImageMediaKey,
        promoHref: input.promoHref,
        promoCaption: input.promoCaption,
        panelWidth: input.panelWidth,
        columnGap: input.columnGap,
        promoImageWidth: input.promoImageWidth,
        promoImageHeight: input.promoImageHeight,
        promoImagePosition: input.promoImagePosition,
      },
      select: MEGA_MENU_ITEM_SELECT,
    });
    return toRecord(row);
  }

  async softDelete(publicId: string): Promise<void> {
    await this.db.megaMenuItem.update({ where: { publicId }, data: { deletedAt: new Date() } });
  }
}
