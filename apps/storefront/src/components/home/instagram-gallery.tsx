import { CameraIcon } from '@heroicons/react/24/outline';

const TILE_GRADIENTS = [
  'from-jet to-charcoal',
  'from-champagne to-champagne-light',
  'from-charcoal to-jet',
  'from-rose to-champagne',
  'from-champagne-light to-champagne',
  'from-charcoal to-rose',
];

/** Static placeholder — no Instagram API integration in this phase. */
export function InstagramGallery() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-jet sm:text-3xl">Follow Us on Instagram</h2>
        <span className="text-sm font-medium text-champagne">@omeshop</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {TILE_GRADIENTS.map((gradient, i) => (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br text-white/70 ${gradient}`}
          >
            <CameraIcon className="size-6" />
          </div>
        ))}
      </div>
    </section>
  );
}
