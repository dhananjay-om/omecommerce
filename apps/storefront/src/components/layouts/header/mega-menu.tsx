import Link from 'next/link';
import type { CategoryNode } from '@/lib/category-tree';

/**
 * Desktop nav with a hover-triggered dropdown per root category (plan/14
 * Phase 1). Pure CSS (`group`/`group-hover`), no JS state — the primitives
 * copied from admin don't include a NavigationMenu component, and this
 * doesn't need one.
 */
export function MegaMenu({ tree }: { tree: CategoryNode[] }) {
  const staticLinks = [
    { href: '/products', label: 'Products' },
    { href: '/brands', label: 'Brands' },
    { href: '/offers', label: 'Offers' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <nav className="hidden items-center gap-1 lg:flex">
      <Link href="/" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
        Home
      </Link>
      {tree.map((node) => (
        <div key={node.category.publicId} className="group relative">
          <Link
            href={`/collections/${node.category.slug}`}
            className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {node.category.nameDefault ?? node.category.slug}
          </Link>
          {node.children.length > 0 ? (
            // group-focus-within (not just group-hover): visibility:hidden removes an
            // element from the tab order entirely, so a keyboard user tabbing to the
            // parent link — the only always-focusable trigger here — needs :focus-within
            // on the group to reveal the children before Tab can ever reach them.
            <div className="invisible absolute top-full left-0 z-40 min-w-48 rounded-lg border bg-popover p-2 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              {node.children.map((child) => (
                <Link
                  key={child.category.publicId}
                  href={`/collections/${child.category.slug}`}
                  className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  {child.category.nameDefault ?? child.category.slug}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      {staticLinks.map((link) => (
        <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
