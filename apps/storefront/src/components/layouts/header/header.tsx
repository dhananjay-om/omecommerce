import type { Category } from '@/types/category';
import type { Website } from '@/types/website';
import type { MegaMenuItem } from '@/types/mega-menu';
import { AnnouncementBar } from './announcement-bar';
import { MainHeader } from './main-header';

export function Header({
  categories,
  website,
  megaMenuItems,
}: {
  categories: Category[];
  website: Website;
  megaMenuItems: MegaMenuItem[];
}) {
  return (
    <header className="sticky top-0 z-30">
      <AnnouncementBar />
      <MainHeader categories={categories} website={website} megaMenuItems={megaMenuItems} />
    </header>
  );
}
