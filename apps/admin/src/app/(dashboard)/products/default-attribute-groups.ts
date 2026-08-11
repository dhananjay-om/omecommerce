import type { AttributeSetGroupDetail } from '@/lib/types';

/**
 * Fixed Description + SEO fields shown on every product's create/edit form, regardless of
 * which attribute set is selected — unlike the dynamic groups from AttributeSetDetail, these
 * aren't assigned into any attribute set. They render through the exact same
 * AttributeFieldsSection/attr__<code> mechanism as set-scoped attributes (AssignAttributeValues
 * only requires the Attribute to exist in the reusable library, not that it's set-scoped), so
 * saving them needs no backend changes — just the six Attribute rows themselves, created once
 * in prisma/seed.ts's "system default attributes" block.
 *
 * Negative sortOrder/synthetic string ids keep them visually first and distinct from any real
 * AttributeSetGroup (whose ids are numeric-string database ids).
 */
export const DESCRIPTION_GROUP: AttributeSetGroupDetail = {
  id: '__description__',
  name: 'Description',
  sortOrder: -2,
  attributes: [
    { code: 'description', label: 'Description', dataType: 'RICHTEXT', isRequired: false, sortOrder: 0, options: [] },
    { code: 'short_description', label: 'Short Description', dataType: 'TEXTAREA', isRequired: false, sortOrder: 1, options: [] },
  ],
};

export const SEO_GROUP: AttributeSetGroupDetail = {
  id: '__seo__',
  name: 'Search Engine Optimization',
  sortOrder: -1,
  attributes: [
    { code: 'url_key', label: 'URL Key', dataType: 'TEXT', isRequired: false, sortOrder: 0, options: [] },
    { code: 'meta_title', label: 'Meta Title', dataType: 'TEXT', isRequired: false, sortOrder: 1, options: [] },
    { code: 'meta_keywords', label: 'Meta Keywords', dataType: 'TEXT', isRequired: false, sortOrder: 2, options: [] },
    { code: 'meta_description', label: 'Meta Description', dataType: 'TEXTAREA', isRequired: false, sortOrder: 3, options: [] },
  ],
};

export const DEFAULT_ATTRIBUTE_GROUPS: AttributeSetGroupDetail[] = [DESCRIPTION_GROUP, SEO_GROUP];
