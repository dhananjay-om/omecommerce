export interface Category {
  publicId: string;
  parentId: string | null;
  slug: string;
  type: string;
  sortMode: string;
  position: number;
  nameDefault: string | null;
  description: string | null;
  imageMediaKey: string | null;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  includeInMenu: boolean;
  createdAt: string;
}

export interface CategoryWithBreadcrumb {
  category: Category;
  breadcrumb: Category[];
}

export interface Brand {
  publicId: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
}
