import type { MegaMenuItemRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toMegaMenuItemView } from './mega-menu-item-view.js';
import type { CreateMegaMenuItemCommand, UpdateMegaMenuItemCommand, MegaMenuItemView } from './dto.js';

export class CreateMegaMenuItem {
  constructor(private readonly items: MegaMenuItemRepository) {}

  async execute(cmd: CreateMegaMenuItemCommand): Promise<MegaMenuItemView> {
    const item = await this.items.create(cmd);
    return toMegaMenuItemView(item);
  }
}

export class UpdateMegaMenuItem {
  constructor(private readonly items: MegaMenuItemRepository) {}

  async execute(cmd: UpdateMegaMenuItemCommand): Promise<MegaMenuItemView> {
    if (!(await this.items.findByPublicId(cmd.publicId))) {
      throw new NotFoundError('mega menu item', cmd.publicId);
    }
    const item = await this.items.update(cmd.publicId, cmd);
    return toMegaMenuItemView(item);
  }
}

/** Admin browse (Content > Mega Menu). */
export class ListMegaMenuItems {
  constructor(private readonly items: MegaMenuItemRepository) {}

  async execute(): Promise<MegaMenuItemView[]> {
    const rows = await this.items.list();
    return Promise.all(rows.map(toMegaMenuItemView));
  }
}

export class GetMegaMenuItemByPublicId {
  constructor(private readonly items: MegaMenuItemRepository) {}

  async execute(publicId: string): Promise<MegaMenuItemView> {
    const item = await this.items.findByPublicId(publicId);
    if (!item) throw new NotFoundError('mega menu item', publicId);
    return toMegaMenuItemView(item);
  }
}

export class DeleteMegaMenuItem {
  constructor(private readonly items: MegaMenuItemRepository) {}

  async execute(publicId: string): Promise<void> {
    if (!(await this.items.findByPublicId(publicId))) {
      throw new NotFoundError('mega menu item', publicId);
    }
    await this.items.softDelete(publicId);
  }
}

/** Storefront read (the header's mega menu) — active items only. When
 *  this returns an empty array, the storefront falls back to the
 *  original auto-generated-from-categories menu (see mega-menu.tsx's own
 *  doc comment) rather than rendering an empty header. */
export class ListActiveMegaMenuItems {
  constructor(private readonly items: MegaMenuItemRepository) {}

  async execute(): Promise<MegaMenuItemView[]> {
    const rows = await this.items.listActive();
    return Promise.all(rows.map(toMegaMenuItemView));
  }
}
