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
  const base = { page: 'home', isActive: true, updatedAt: '', title: null } as const;
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

export function WidgetZone({ widgets, section }: { widgets: WidgetInstance[]; section: WidgetSection }) {
  const active = widgets.length > 0 ? widgets : fallbackWidgetsFor(section);
  return (
    <>
      {active.map((w) => (
        <Reveal key={w.publicId}>
          <WidgetRenderer widget={w} />
        </Reveal>
      ))}
    </>
  );
}
