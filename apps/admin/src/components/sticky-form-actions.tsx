import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * A persistent bottom action bar for long forms — stays visible on screen
 * no matter how far down the page you've scrolled, instead of a plain
 * "Save" button sitting wherever the form happens to end (easy to lose on
 * a page with several SectionCards, or, on the product edit page, several
 * MORE sections after the form itself).
 *
 * `position: sticky`, not `fixed`: this used to be `fixed` — pinned
 * against the viewport directly, with `left-62` hand-matching the
 * sidebar's width so the bar wouldn't render underneath it, plus a manual
 * spacer div so the form's real last section never ended up hidden behind
 * it. That worked for tall forms, but `fixed` positioning is glued to the
 * viewport's bottom edge unconditionally — on a shorter form (or a
 * shorter category/attribute list after a trim), the page's real content
 * ends well above the viewport's bottom, leaving a large dead gap between
 * the last card and the floating bar (caught live via a screenshot: a
 * short products's Categories card ended, then several hundred px of
 * blank page, then the bar).
 *
 * `sticky` fixes this by construction instead of patching around it: it
 * stays in normal document flow (no more hand-matched `left-*` offset, no
 * more manual spacer — both were only needed to work around `fixed`
 * taking the element out of flow), so on a short form it just settles
 * right after the last card with no gap, and on a form taller than the
 * viewport it still pins to the bottom exactly like before, because its
 * un-stuck position is already below the fold from the first paint. The
 * `<main>` in `(dashboard)/layout.tsx` (`overflow-y-auto`) is a genuine
 * bounded scroll container — confirmed live (`main.scrollHeight >
 * main.clientHeight` on a real long form) — so sticky's nearest-scrolling-
 * ancestor computation resolves against it correctly.
 *
 * `formId` is optional — pass it (and give the actual <form> a matching
 * `id`) when this bar needs to render OUTSIDE that <form> in the DOM (e.g.
 * the product edit page, which has more sections after the form closes);
 * the button's `form` attribute submits it regardless of DOM nesting, a
 * plain HTML5 mechanism, not a hack. Omit it when the bar renders as the
 * form's own last child — the default, most edit forms' case.
 */
export function StickyFormActions({
  pending,
  label,
  pendingLabel,
  error,
  formId,
  extra,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  error?: string | null;
  formId?: string;
  extra?: ReactNode;
}) {
  return (
    <>
      <div className="sticky inset-x-0 bottom-0 z-30 border-t bg-background/95 py-4 shadow-[0_-4px_16px_rgba(16,19,26,0.06)] backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-8">
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? pendingLabel : label}
          </Button>
          {extra}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </>
  );
}
