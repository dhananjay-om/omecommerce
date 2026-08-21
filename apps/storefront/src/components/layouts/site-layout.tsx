import { listCategories } from '@/services/category.service';
import { getWebsite } from '@/services/website.service';
import type { Website } from '@/types/website';
import { Header } from './header/header';
import { Footer } from './footer';
import { PageTransition } from '@/components/motion/page-transition';

const FALLBACK_WEBSITE: Website = { name: 'OMEShop', logoUrl: null };

/** The one shared layout every page renders inside (per the spec: "Every page should use the same layout"). */
export async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [categories, website] = await Promise.all([
    listCategories(),
    // The header/footer render on EVERY page — a website-branding hiccup
    // must never take the whole site down with it, so this falls back to
    // the plain "OMEShop" text logo instead of throwing (unlike categories,
    // which the page genuinely can't render meaningfully without).
    getWebsite().catch(() => FALLBACK_WEBSITE),
  ]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50"
      >
        Skip to content
      </a>
      <Header categories={categories} website={website} />
      <main id="main-content" className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer website={website} />
    </>
  );
}
