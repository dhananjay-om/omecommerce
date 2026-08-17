import 'server-only';
import { apiGet, buildQuery, ApiError } from '@/lib/api-client';
import { STORE_VIEW_ID } from '@/lib/config';

export interface CmsPage {
  publicId: string;
  handle: string;
  title: string;
  body: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  updatedAt: string;
}

export interface CmsBlock {
  publicId: string;
  code: string;
  body: string;
  status: 'DRAFT' | 'PUBLISHED';
  updatedAt: string;
}

/** Server Component reads only — direct to Express, same pattern as products.service.ts. */
export function getCmsPage(handle: string): Promise<CmsPage> {
  return apiGet<CmsPage>(`/store/v1/content/pages/${handle}${buildQuery({ storeViewId: STORE_VIEW_ID })}`);
}

export function getCmsBlock(code: string): Promise<CmsBlock> {
  return apiGet<CmsBlock>(`/store/v1/content/blocks/${code}${buildQuery({ storeViewId: STORE_VIEW_ID })}`);
}

/** Missing/unpublished block -> undefined instead of throwing — used by the
 *  home page's optional CMS-managed sections, which must fall back to their
 *  hardcoded defaults rather than 500ing the whole page over one block. */
export async function getCmsBlockOrUndefined(code: string): Promise<CmsBlock | undefined> {
  try {
    return await getCmsBlock(code);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}
