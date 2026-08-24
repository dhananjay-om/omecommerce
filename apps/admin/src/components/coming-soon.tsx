import { Sparkles, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { navItemByHref } from '@/lib/nav-data';

/**
 * Standard placeholder for every nav item without a real backend yet
 * (admin UI revamp plan). Every not-yet-real route's `page.tsx` is a
 * 3-line file rendering `<ComingSoon href="/the/route" />` — flipping an
 * item from placeholder to real later means deleting that one file, since
 * nothing else references it. Deliberately does NOT read like a 404: this
 * is "on the roadmap," not "broken" — the nav item is real, the page just
 * isn't built yet (see nav-data.ts's own header comment).
 */
export function ComingSoon({ href }: { href: string }) {
  const item = navItemByHref(href);
  const Icon = item?.icon ?? Sparkles;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{item?.label ?? 'Coming Soon'}</h1>
        <Badge variant="secondary">Planned</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
            <Icon className="size-6 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="max-w-md space-y-1">
            <p className="font-medium text-foreground">This section isn&apos;t built yet</p>
            <p className="text-sm text-muted-foreground">{item?.description ?? "This feature is on the roadmap and hasn't been built yet."}</p>
          </div>
          {item?.planned && item.planned.length > 0 ? (
            <ul className="mt-2 max-w-md space-y-1.5 text-left text-sm text-muted-foreground">
              {item.planned.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Same empty-state Card as `ComingSoon`, without the page title/breadcrumb
 * row — for a tab *within* an already-titled page (e.g. a product detail
 * tab) rather than a whole top-level nav route. Doesn't read `nav-data.ts`
 * since these tabs aren't top-level nav items; callers pass their own copy.
 */
export function InlineComingSoon({ icon: Icon = Sparkles, description }: { icon?: LucideIcon; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Icon className="size-6 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div className="max-w-md space-y-1">
          <p className="font-medium text-foreground">This section isn&apos;t built yet</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
