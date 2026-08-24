import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * A persistent bottom action bar for long forms — stays visible on screen
 * no matter how far down the page you've scrolled, instead of a plain
 * "Save" button sitting wherever the form happens to end (easy to lose on
 * a page with several SectionCards, or, on the product edit page, several
 * MORE sections after the form itself).
 *
 * `position: fixed`, not `sticky`: the dashboard layout's `<main>` carries
 * an `overflow-y-auto` class, but its height isn't actually bounded by its
 * flex parent in practice — the real scrolling happens on the document
 * itself, not inside `<main>`'s own box. `position: sticky` computes
 * against the nearest ancestor that establishes a scroll container
 * (`<main>`, because of that class), so a sticky bar there never reaches
 * the visible viewport edge — it "sticks" only within `<main>`'s own
 * (effectively unbounded) box, which in practice means it never visibly
 * sticks at all. `fixed` sidesteps that mismatch entirely by positioning
 * against the viewport directly. `left-62` matches the sidebar's own
 * fixed width (components/app-sidebar.tsx's `<aside className="w-62">`)
 * so the bar starts after it instead of rendering underneath it — this
 * was still `left-20`, sized for the icon-rail sidebar the admin UI
 * revamp replaced, until a screenshot caught the bar rendering mostly
 * hidden behind the new 248px sidebar.
 *
 * Renders its own spacer of matching height as the last element, so a
 * form's real final section (e.g. "Images") never ends up hidden behind
 * this now-out-of-flow bar — callers don't need to remember one themselves.
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
      <div className="fixed inset-x-0 bottom-0 left-62 z-30 border-t bg-background/95 py-4 shadow-[0_-4px_16px_rgba(16,19,26,0.06)] backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-8">
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? pendingLabel : label}
          </Button>
          {extra}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
      {/* A bit taller than the bar's own rendered height (py-4 + button/text line-height, ~65px) — the extra margin is deliberate breathing room, not just exact clearance, so the last real section never feels crowded against the floating bar above it. */}
      <div className="h-24" aria-hidden="true" />
    </>
  );
}
