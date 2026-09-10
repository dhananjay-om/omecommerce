export interface MegaMenuLink {
  label: string;
  href: string;
}

export interface MegaMenuColumn {
  heading: string;
  links: MegaMenuLink[];
}

export interface MegaMenuItemRecord {
  publicId: string;
  label: string;
  href: string;
  position: number;
  isActive: boolean;
  columns: MegaMenuColumn[];
  promoImageMediaKey: string | null;
  promoHref: string | null;
  promoCaption: string | null;
  updatedAt: Date;
}

export interface CreateMegaMenuItemInput {
  label: string;
  href: string;
  position?: number;
  isActive?: boolean;
  columns?: MegaMenuColumn[];
  promoImageMediaKey?: string | null;
  promoHref?: string | null;
  promoCaption?: string | null;
}

export interface UpdateMegaMenuItemInput {
  label?: string;
  href?: string;
  position?: number;
  isActive?: boolean;
  columns?: MegaMenuColumn[];
  promoImageMediaKey?: string | null;
  promoHref?: string | null;
  promoCaption?: string | null;
}

export interface MegaMenuItemRepository {
  create(input: CreateMegaMenuItemInput): Promise<MegaMenuItemRecord>;
  findByPublicId(publicId: string): Promise<MegaMenuItemRecord | null>;
  /** Admin browse — every non-deleted item, ordered the same way the
   *  storefront will render them (position), so the admin list preview
   *  matches reality. */
  list(): Promise<MegaMenuItemRecord[]>;
  /** Storefront read — active items only, ordered by position. */
  listActive(): Promise<MegaMenuItemRecord[]>;
  update(publicId: string, input: UpdateMegaMenuItemInput): Promise<MegaMenuItemRecord>;
  softDelete(publicId: string): Promise<void>;
}
