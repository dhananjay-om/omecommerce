import { StarIcon } from '@heroicons/react/24/solid';

interface Testimonial {
  name: string;
  quote: string;
  location?: string;
  item?: string;
  rating?: number;
}

/** Default placeholder quotes, shown when the admin hasn't set anything
 *  under Content > Home Page — there's still no real review/testimonial
 *  backend (reviews ship UI-only), this is just admin-editable copy now
 *  instead of a hardcoded constant. */
const DEFAULT_TESTIMONIALS: Testimonial[] = [
  { name: 'Amara K.', location: 'Austin', quote: 'Fast shipping and the quality is exactly as described. My new go-to store.', item: 'Wireless Earbuds', rating: 5 },
  { name: 'Daniel R.', location: 'Chicago', quote: 'Customer support helped me swap a size within minutes. Great experience.', item: 'Classic T-Shirt', rating: 5 },
  { name: 'Priya S.', location: 'Seattle', quote: 'Love the selection — found things here I couldn’t find anywhere else.', item: 'Coffee Maker', rating: 4 },
];

export function Testimonials({ testimonials }: { testimonials?: Testimonial[] }) {
  const activeTestimonials = testimonials && testimonials.length > 0 ? testimonials : DEFAULT_TESTIMONIALS;
  return (
    <section className="bg-ivory py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-champagne uppercase">Real reviews</p>
          <h2 className="font-display mt-2 text-3xl font-semibold text-jet sm:text-4xl">What people are saying</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {activeTestimonials.map((t, i) => (
            <div key={i} className="rounded-2xl border border-ghost bg-white p-6 shadow-sm">
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} className={`size-4 ${i < (t.rating ?? 5) ? 'text-champagne' : 'text-silver'}`} />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-charcoal">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-5 flex items-center justify-between border-t border-ghost pt-4">
                <div>
                  <p className="text-xs font-semibold text-jet">{t.name}</p>
                  {t.location ? <p className="text-xs text-slate">{t.location}</p> : null}
                </div>
                {t.item ? <p className="max-w-[100px] text-right text-[10px] text-slate italic">{t.item}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
