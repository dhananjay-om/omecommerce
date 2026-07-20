import { listCategories } from '@/services/category.service';
import { Header } from './header/header';
import { Footer } from './footer';
import { PageTransition } from '@/components/motion/page-transition';

/** The one shared layout every page renders inside (per the spec: "Every page should use the same layout"). */
export async function SiteLayout({ children }: { children: React.ReactNode }) {
  const categories = await listCategories();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50"
      >
        Skip to content
      </a>
      <Header categories={categories} />
      <main id="main-content" className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
    </>
  );
}
