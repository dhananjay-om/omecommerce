import type { WidgetType, WidgetSection } from '@prisma/client';

export interface WidgetInstanceRecord {
  publicId: string;
  type: WidgetType;
  page: string;
  section: WidgetSection;
  position: number;
  title: string | null;
  isActive: boolean;
  config: unknown;
  updatedAt: Date;
}

export interface CreateWidgetInstanceInput {
  type: WidgetType;
  page?: string;
  section: WidgetSection;
  position?: number;
  title?: string | null;
  isActive?: boolean;
  config: unknown;
}

export interface UpdateWidgetInstanceInput {
  section?: WidgetSection;
  position?: number;
  title?: string | null;
  isActive?: boolean;
  config?: unknown;
}

export interface WidgetInstanceRepository {
  create(input: CreateWidgetInstanceInput): Promise<WidgetInstanceRecord>;
  findByPublicId(publicId: string): Promise<WidgetInstanceRecord | null>;
  /** Admin browse — every non-deleted widget for a page, ordered by section then position. */
  listForPage(page: string): Promise<WidgetInstanceRecord[]>;
  /** Storefront read — active widgets for one page+section, ordered by position. */
  listActiveForSection(page: string, section: WidgetSection): Promise<WidgetInstanceRecord[]>;
  update(publicId: string, input: UpdateWidgetInstanceInput): Promise<WidgetInstanceRecord>;
  softDelete(publicId: string): Promise<void>;
}
