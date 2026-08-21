import type { Category } from '@/types/category';
import type { Website } from '@/types/website';
import { AnnouncementBar } from './announcement-bar';
import { MainHeader } from './main-header';

export function Header({ categories, website }: { categories: Category[]; website: Website }) {
  return (
    <header className="sticky top-0 z-30">
      <AnnouncementBar />
      <MainHeader categories={categories} website={website} />
    </header>
  );
}
