import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';
import { listCategories } from '@/services/category.service';
import { listBrands } from '@/services/brand.service';
import { searchProducts } from '@/services/products.service';

const STATIC_PAGES = ['', '/products', '/brands', '/offers', '/about', '/contact', '/cart', '/login', '/register'];

/** Native Next.js sitemap (plan/14 Phase 8) — categories/brands/products pulled live rather than hardcoded, so it stays accurate as the catalog changes. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, brands, products] = await Promise.all([
    listCategories(),
    listBrands(),
    searchProducts({ pageSize: 100 }),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.5,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/collections/${c.slug}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const brandEntries: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${SITE_URL}/brands/${b.slug}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  const productEntries: MetadataRoute.Sitemap = products.hits.map((p) => ({
    url: `${SITE_URL}/${p.slug}.html`,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  return [...staticEntries, ...categoryEntries, ...brandEntries, ...productEntries];
}
