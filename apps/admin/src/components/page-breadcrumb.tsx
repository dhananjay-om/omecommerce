import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/** A small trail above a detail page's title (e.g. "Commerce > Orders >
 *  #100245") — matches the mock's breadcrumb convention on every detail
 *  view, replacing a plain "← Back to X" link. The last segment is always
 *  the current page and never a link. */
export function PageBreadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 ? <ChevronRight className="size-3.5" /> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
