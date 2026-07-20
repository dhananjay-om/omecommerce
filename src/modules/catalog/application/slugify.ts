import type { CategoryRepository } from '../domain/repositories.js';

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'category';
}

/** Appends -2, -3, ... until a free slug is found — admin-scale category counts, a few lookups is fine. */
export async function uniqueCategorySlug(categories: CategoryRepository, nameDefault: string | null | undefined): Promise<string> {
  const base = slugify(nameDefault ?? 'category');
  let candidate = base;
  let suffix = 2;
  while (await categories.findBySlug(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
