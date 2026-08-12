import type { Category } from '@/types/category';

export interface CategoryNode {
  category: Category;
  children: CategoryNode[];
}

/** Flat list -> tree, same pattern as the admin app's category picker (admin-scale, small table — a plain in-memory build is simpler than a recursive query). */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byParent = new Map<string, Category[]>();
  for (const c of categories) {
    const key = c.parentId ?? '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  function build(parentKey: string): CategoryNode[] {
    return (byParent.get(parentKey) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((category) => ({ category, children: build(category.publicId) }));
  }
  return build('');
}
