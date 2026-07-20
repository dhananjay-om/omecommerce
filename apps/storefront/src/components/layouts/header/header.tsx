import type { Category } from '@/types/category';
import { AnnouncementBar } from './announcement-bar';
import { MainHeader } from './main-header';

export function Header({ categories }: { categories: Category[] }) {
  return (
    <header className="sticky top-0 z-30">
      <AnnouncementBar />
      <MainHeader categories={categories} />
    </header>
  );
}
