import type { WidgetType, WidgetSection } from '@prisma/client';

export interface CreateWidgetInstanceCommand {
  type: WidgetType;
  page?: string;
  section: WidgetSection;
  position?: number;
  title?: string | null;
  isActive?: boolean;
  config: unknown;
  customCss?: string | null;
}

export interface UpdateWidgetInstanceCommand {
  publicId: string;
  section?: WidgetSection;
  position?: number;
  title?: string | null;
  isActive?: boolean;
  config?: unknown;
  customCss?: string | null;
}

export interface WidgetInstanceView {
  publicId: string;
  type: WidgetType;
  page: string;
  section: WidgetSection;
  position: number;
  title: string | null;
  isActive: boolean;
  config: unknown;
  customCss: string | null;
  updatedAt: string;
}
