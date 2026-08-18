import type { WidgetInstance, WidgetSection } from '@/services/widget.service';
import { Reveal } from '@/components/motion/reveal';
import { WidgetRenderer } from './widget-renderer';

/** Same default arrangement `prisma/seed.ts` writes for a fresh install —
 *  used ONLY when the DB has zero widgets for a given page+section, so the
 *  home page never regresses to a blank zone on an environment that hasn't
 *  run `db:seed` (a dev/staging convenience script, not guaranteed in
 *  every environment, same caveat that already applies to its website/
 *  store/product rows). `publicId` here is a synthetic React key, not a
 *  real widget — nothing about these is persisted or editable. */
function fallbackWidgetsFor(section: WidgetSection): WidgetInstance[] {
  const base = { page: 'home', isActive: true, updatedAt: '', title: null, customCss: null } as const;
  if (section === 'TOP') {
    return [{ ...base, publicId: 'fallback-hero', type: 'HERO_BANNER_SLIDER', section, position: 0, config: {} }];
  }
  if (section === 'MIDDLE') {
    return [
      { ...base, publicId: 'fallback-category-grid', type: 'CATEGORY_GRID', section, position: 0, title: 'Shop by Category', config: {} },
      { ...base, publicId: 'fallback-promo-grid', type: 'PROMO_BANNER_GRID', section, position: 1, config: {} },
      { ...base, publicId: 'fallback-brand-grid', type: 'BRAND_GRID', section, position: 2, title: 'Top Brands', config: {} },
      { ...base, publicId: 'fallback-why-choose-us', type: 'WHY_CHOOSE_US_LIST', section, position: 3, config: {} },
      { ...base, publicId: 'fallback-testimonials', type: 'TESTIMONIAL_LIST', section, position: 4, config: {} },
    ];
  }
  return [];
}

/** An admin's `customCss` (Content > Widgets > Advanced) is injected here,
 *  right next to that instance's own markup, scoped by wrapping every
 *  widget in a `data-widget-instance` container an admin can target with
 *  `[data-widget-instance="<publicId>"] { ... }` — unscoped rules apply
 *  globally to the page, which is expected for a raw-CSS power-user field
 *  (no sanitization, same trust level as CmsPage/CmsBlock's HTML body). */
export function WidgetZone({ widgets, section }: { widgets: WidgetInstance[]; section: WidgetSection }) {
  const active = widgets.length > 0 ? widgets : fallbackWidgetsFor(section);
  return (
    <>
      {active.map((w) => (
        <div key={w.publicId} data-widget-instance={w.publicId}>
          <Reveal>
            <WidgetRenderer widget={w} />
          </Reveal>
          {w.customCss ? <style dangerouslySetInnerHTML={{ __html: w.customCss }} /> : null}
        </div>
      ))}
    </>
  );
}
