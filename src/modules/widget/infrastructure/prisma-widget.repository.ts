import type { WidgetSection } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  WidgetInstanceRepository,
  WidgetInstanceRecord,
  CreateWidgetInstanceInput,
  UpdateWidgetInstanceInput,
} from '../domain/repositories.js';

const WIDGET_SELECT = {
  publicId: true,
  type: true,
  page: true,
  section: true,
  position: true,
  title: true,
  isActive: true,
  config: true,
  customCss: true,
  updatedAt: true,
} as const;

export class PrismaWidgetInstanceRepository implements WidgetInstanceRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateWidgetInstanceInput): Promise<WidgetInstanceRecord> {
    return this.db.widgetInstance.create({
      data: {
        type: input.type,
        page: input.page,
        section: input.section,
        position: input.position,
        title: input.title,
        isActive: input.isActive,
        config: input.config as object,
        customCss: input.customCss,
      },
      select: WIDGET_SELECT,
    });
  }

  async findByPublicId(publicId: string): Promise<WidgetInstanceRecord | null> {
    return this.db.widgetInstance.findFirst({ where: { publicId, deletedAt: null }, select: WIDGET_SELECT });
  }

  async listForPage(page: string): Promise<WidgetInstanceRecord[]> {
    return this.db.widgetInstance.findMany({
      where: { page, deletedAt: null },
      select: WIDGET_SELECT,
      orderBy: [{ section: 'asc' }, { position: 'asc' }],
    });
  }

  async listActiveForSection(page: string, section: WidgetSection): Promise<WidgetInstanceRecord[]> {
    return this.db.widgetInstance.findMany({
      where: { page, section, isActive: true, deletedAt: null },
      select: WIDGET_SELECT,
      orderBy: { position: 'asc' },
    });
  }

  async update(publicId: string, input: UpdateWidgetInstanceInput): Promise<WidgetInstanceRecord> {
    return this.db.widgetInstance.update({
      where: { publicId },
      data: {
        section: input.section,
        position: input.position,
        title: input.title,
        isActive: input.isActive,
        config: input.config as object | undefined,
        customCss: input.customCss,
      },
      select: WIDGET_SELECT,
    });
  }

  async softDelete(publicId: string): Promise<void> {
    await this.db.widgetInstance.update({ where: { publicId }, data: { deletedAt: new Date() } });
  }
}
