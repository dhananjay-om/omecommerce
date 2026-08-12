import { StarIcon } from '@heroicons/react/24/solid';

/** Static placeholder content — there's no review/testimonial backend (product decision: reviews ship UI-only, plan/14 context). */
const TESTIMONIALS = [
  { id: 't1', name: 'Amara K.', quote: 'Fast shipping and the quality is exactly as described. My new go-to store.' },
  { id: 't2', name: 'Daniel R.', quote: 'Customer support helped me swap a size within minutes. Great experience.' },
  { id: 't3', name: 'Priya S.', quote: 'Love the selection — found things here I couldn’t find anywhere else.' },
];

export function Testimonials() {
  return (
    <section className="bg-muted/40 py-10">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-4 text-xl font-bold sm:text-2xl">What Our Customers Say</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.id} className="rounded-lg border bg-background p-5">
              <div className="mb-2 flex gap-0.5 text-cta">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} className="size-4" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">&ldquo;{t.quote}&rdquo;</p>
              <p className="mt-3 text-sm font-semibold">{t.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
