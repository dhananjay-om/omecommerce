import { apiGet } from '@/lib/api-client';
import type { CmsBlock } from '@/lib/types';
import { HomePageSectionForm } from './home-page-section-form';
import { HERO_FIELDS, PROMO_FIELDS, WHY_CHOOSE_US_FIELDS, TESTIMONIAL_FIELDS } from './section-fields';
import { saveHeroBanner, savePromoBanners, saveWhyChooseUs, saveTestimonials } from './actions';

/** Best-effort JSON parse of a well-known block's body — a hand-edited (via
 *  Content > Blocks) or corrupted body shouldn't crash this screen, it
 *  should just show up as an empty starting section. */
function rowsFromBlock(blocks: CmsBlock[], code: string, arrayKey: string): Array<Record<string, string>> {
  const block = blocks.find((b) => b.code === code);
  if (!block) return [];
  try {
    const parsed = JSON.parse(block.body);
    return Array.isArray(parsed?.[arrayKey]) ? parsed[arrayKey] : [];
  } catch {
    return [];
  }
}

export default async function HomePageContentPage() {
  const blocks = await apiGet<CmsBlock[]>('/admin/v1/cms/blocks');

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Home Page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the content sections shown on the storefront home page. Each section saves as soon as you click its own Save button — changes go
          live immediately.
        </p>
      </div>

      <div className="mt-6 max-w-3xl space-y-6">
        <HomePageSectionForm
          title="Hero Banner"
          description="The rotating banner at the very top of the home page."
          fields={HERO_FIELDS}
          initialRows={rowsFromBlock(blocks, 'home_hero_banner', 'slides')}
          hiddenFieldName="slidesJson"
          action={saveHeroBanner}
          addLabel="Add Slide"
        />
        <HomePageSectionForm
          title="Promo Banners"
          description="The 2×2 grid of promotional tiles below the featured products."
          fields={PROMO_FIELDS}
          initialRows={rowsFromBlock(blocks, 'home_promo_banners', 'banners')}
          hiddenFieldName="bannersJson"
          action={savePromoBanners}
          addLabel="Add Banner"
        />
        <HomePageSectionForm
          title="Why Choose Us"
          description="The row of 4 trust badges (shipping, security, returns, support)."
          fields={WHY_CHOOSE_US_FIELDS}
          initialRows={rowsFromBlock(blocks, 'home_why_choose_us', 'features')}
          hiddenFieldName="featuresJson"
          action={saveWhyChooseUs}
          addLabel="Add Feature"
        />
        <HomePageSectionForm
          title="Testimonials"
          description="Customer quotes shown in the “What Our Customers Say” section."
          fields={TESTIMONIAL_FIELDS}
          initialRows={rowsFromBlock(blocks, 'home_testimonials', 'testimonials')}
          hiddenFieldName="testimonialsJson"
          action={saveTestimonials}
          addLabel="Add Testimonial"
        />
      </div>
    </div>
  );
}
