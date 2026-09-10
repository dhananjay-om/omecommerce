export interface MegaMenuLink {
  label: string;
  href: string;
}

export interface MegaMenuColumn {
  heading: string;
  links: MegaMenuLink[];
}

/** 'left' | 'right' | 'top' | 'bottom' — fixed vocabulary in app code
 *  (same "no DB enum" precedent as AutomationRule.triggerType). */
export type MegaMenuPromoImagePosition = 'left' | 'right' | 'top' | 'bottom';

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
  /** Layout controls, every one nullable except position — null means
   *  "use the component's own built-in default," see navigation.prisma's
   *  own doc comment. */
  panelWidth: number | null;
  columnGap: number | null;
  promoImageWidth: number | null;
  promoImageHeight: number | null;
  promoImagePosition: MegaMenuPromoImagePosition;
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
  panelWidth?: number | null;
  columnGap?: number | null;
  promoImageWidth?: number | null;
  promoImageHeight?: number | null;
  promoImagePosition?: MegaMenuPromoImagePosition;
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
  panelWidth?: number | null;
  columnGap?: number | null;
  promoImageWidth?: number | null;
  promoImageHeight?: number | null;
  promoImagePosition?: MegaMenuPromoImagePosition;
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
