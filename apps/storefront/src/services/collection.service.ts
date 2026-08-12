import 'server-only';

/**
 * "Collections" in the spec map directly onto the backend's Category entity
 * — there's no separate Collection concept in this schema, and inventing one
 * would just be Category with extra steps. Re-exported under the requested
 * naming so `/collections/[slug]` pages read naturally.
 */
export { listCategories as listCollections, getCategory as getCollection } from './category.service';
