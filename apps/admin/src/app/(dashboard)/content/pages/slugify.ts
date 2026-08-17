/** Simple client-side slugify — the handle is a plain user-editable field
 *  (unlike Category's server-generated+disambiguated slug), so this only
 *  needs to produce a sane starting suggestion; the admin can edit it before
 *  first save, same as a URL key field in Magento's page editor. Not in
 *  actions.ts: a 'use server' file may only export async functions. */
export function slugifyHandle(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
