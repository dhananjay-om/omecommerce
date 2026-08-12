export function slugify(input: string, fallback: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || fallback;
}

/** Appends -2, -3, ... until a free slug is found — admin-scale row counts, a few lookups is fine. */
export async function uniqueSlug(
  findBySlug: (slug: string) => Promise<unknown | null>,
  name: string | null | undefined,
  fallback: string,
): Promise<string> {
  const base = slugify(name ?? fallback, fallback);
  let candidate = base;
  let suffix = 2;
  while (await findBySlug(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
