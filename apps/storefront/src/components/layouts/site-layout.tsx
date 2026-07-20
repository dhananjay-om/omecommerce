import { listCategories } from '@/services/category.service';
import { Header } from './header/header';
import { Footer } from './footer';

/** The one shared layout every page renders inside (per the spec: "Every page should use the same layout"). */
export async function SiteLayout({ children }: { children: React.ReactNode }) {
  const categories = await listCategories();

  return (
    <>
      <Header categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
