import Link from 'next/link';

/**
 * The "← Back to X" link shown above a detail/edit/new page's heading —
 * a handful of pages (order/customer detail, products, companies, ...)
 * already had their own copy of this exact markup; pulled out into one
 * component so every nested page gets it consistently instead of some
 * having it and others not.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-sm text-muted-foreground hover:underline">
      ← {label}
    </Link>
  );
}
