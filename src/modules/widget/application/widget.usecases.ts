import type { WidgetSection } from '@prisma/client';
import type { WidgetInstanceRepository, WidgetInstanceRecord } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CreateWidgetInstanceCommand, UpdateWidgetInstanceCommand, WidgetInstanceView } from './dto.js';

function toView(w: WidgetInstanceRecord): WidgetInstanceView {
  return {
    publicId: w.publicId,
    type: w.type,
    page: w.page,
    section: w.section,
    position: w.position,
    title: w.title,
    isActive: w.isActive,
    config: w.config,
    customCss: w.customCss,
    updatedAt: w.updatedAt.toISOString(),
  };
}

export class CreateWidgetInstance {
  constructor(private readonly widgets: WidgetInstanceRepository) {}

  async execute(cmd: CreateWidgetInstanceCommand): Promise<WidgetInstanceView> {
    const widget = await this.widgets.create(cmd);
    return toView(widget);
  }
}

export class UpdateWidgetInstance {
  constructor(private readonly widgets: WidgetInstanceRepository) {}

  async execute(cmd: UpdateWidgetInstanceCommand): Promise<WidgetInstanceView> {
    if (!(await this.widgets.findByPublicId(cmd.publicId))) {
      throw new NotFoundError('widget', cmd.publicId);
    }
    const widget = await this.widgets.update(cmd.publicId, cmd);
    return toView(widget);
  }
}

/** Admin browse (Content > Widgets) — only page="home" is exposed via the admin UI today. */
export class ListWidgetInstances {
  constructor(private readonly widgets: WidgetInstanceRepository) {}

  async execute(page: string): Promise<WidgetInstanceView[]> {
    const rows = await this.widgets.listForPage(page);
    return rows.map(toView);
  }
}

export class GetWidgetInstanceByPublicId {
  constructor(private readonly widgets: WidgetInstanceRepository) {}

  async execute(publicId: string): Promise<WidgetInstanceView> {
    const widget = await this.widgets.findByPublicId(publicId);
    if (!widget) throw new NotFoundError('widget', publicId);
    return toView(widget);
  }
}

export class DeleteWidgetInstance {
  constructor(private readonly widgets: WidgetInstanceRepository) {}

  async execute(publicId: string): Promise<void> {
    if (!(await this.widgets.findByPublicId(publicId))) {
      throw new NotFoundError('widget', publicId);
    }
    await this.widgets.softDelete(publicId);
  }
}

/** Storefront read (used by page.tsx to build each layout zone). */
export class ListActiveWidgetsForSection {
  constructor(private readonly widgets: WidgetInstanceRepository) {}

  async execute(page: string, section: WidgetSection): Promise<WidgetInstanceView[]> {
    const rows = await this.widgets.listActiveForSection(page, section);
    return rows.map(toView);
  }
}
