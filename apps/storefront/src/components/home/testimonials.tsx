import { StarIcon } from '@heroicons/react/24/solid';

interface Testimonial {
  name: string;
  quote: string;
}

/** Default placeholder quotes, shown when the admin hasn't set anything
 *  under Content > Home Page — there's still no real review/testimonial
 *  backend (reviews ship UI-only), this is just admin-editable copy now
 *  instead of a hardcoded constant. */
const DEFAULT_TESTIMONIALS: Testimonial[] = [
  { name: 'Amara K.', quote: 'Fast shipping and the quality is exactly as described. My new go-to store.' },
  { name: 'Daniel R.', quote: 'Customer support helped me swap a size within minutes. Great experience.' },
  { name: 'Priya S.', quote: 'Love the selection — found things here I couldn’t find anywhere else.' },
];

export function Testimonials({ testimonials }: { testimonials?: Testimonial[] }) {
  const activeTestimonials = testimonials && testimonials.length > 0 ? testimonials : DEFAULT_TESTIMONIALS;
  return (
    <section className="bg-ivory py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="font-display mb-6 text-2xl font-semibold text-jet sm:text-3xl">What Our Customers Say</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {activeTestimonials.map((t, i) => (
            <div key={i} className="rounded-2xl bg-white p-6 ring-1 ring-ghost">
              <div className="mb-3 flex gap-0.5 text-champagne">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} className="size-4" />
                ))}
              </div>
              <p className="text-sm text-charcoal">&ldquo;{t.quote}&rdquo;</p>
              <p className="mt-4 text-sm font-semibold text-jet">{t.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
