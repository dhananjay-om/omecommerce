export interface Category {
  publicId: string;
  parentId: string | null;
  slug: string;
  type: string;
  sortMode: string;
  position: number;
  nameDefault: string | null;
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
