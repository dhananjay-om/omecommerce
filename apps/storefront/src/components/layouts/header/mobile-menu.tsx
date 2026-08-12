'use client';

import Link from 'next/link';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { CategoryNode } from '@/lib/category-tree';

const staticLinks = [
  { href: '/products', label: 'Products' },
  { href: '/brands', label: 'Brands' },
  { href: '/offers', label: 'Offers' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

function CategoryLinks({ nodes, depth = 0 }: { nodes: CategoryNode[]; depth?: number }) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.category.publicId}>
          <Link
            href={`/collections/${node.category.slug}`}
            className="block rounded-md px-2 py-2 text-sm hover:bg-muted"
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            {node.category.nameDefault ?? node.category.slug}
          </Link>
          {node.children.length > 0 ? <CategoryLinks nodes={node.children} depth={depth + 1} /> : null}
        </div>
      ))}
    </>
  );
}

export function MobileMenu({ tree }: { tree: CategoryNode[] }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden">
            <Bars3Icon className="size-6" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-4/5 max-w-xs">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-4">
          <Link href="/" className="block rounded-md px-2 py-2 text-sm font-medium hover:bg-muted">
            Home
          </Link>
          <CategoryLinks nodes={tree} />
          <div className="my-2 h-px bg-border" />
          {staticLinks.map((link) => (
            <Link key={link.href} href={link.href} className="block rounded-md px-2 py-2 text-sm hover:bg-muted">
              {link.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
