export interface MegaMenuLink {
  label: string;
  href: string;
}

export interface MegaMenuColumn {
  heading: string;
  links: MegaMenuLink[];
}

export type MegaMenuPromoImagePosition = 'left' | 'right' | 'top' | 'bottom';

export interface MegaMenuItem {
  publicId: string;
  label: string;
  href: string;
  position: number;
  isActive: boolean;
  columns: MegaMenuColumn[];
  promoImageMediaKey: string | null;
  promoImageUrl: string | null;
  promoHref: string | null;
  promoCaption: string | null;
  /** Layout controls — null means "use the component's own default." */
  panelWidth: number | null;
  columnGap: number | null;
  promoImageWidth: number | null;
  promoImageHeight: number | null;
  promoImagePosition: MegaMenuPromoImagePosition;
  updatedAt: string;
}
