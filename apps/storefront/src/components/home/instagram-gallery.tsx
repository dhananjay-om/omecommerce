import { CameraIcon } from '@heroicons/react/24/outline';

const TILE_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-rose-500 to-orange-500',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-violet-500 to-purple-600',
  'from-sky-500 to-blue-600',
];

/** Static placeholder — no Instagram API integration in this phase. */
export function InstagramGallery() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold sm:text-2xl">Follow Us on Instagram</h2>
        <span className="text-sm font-medium text-primary">@omeshop</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {TILE_GRADIENTS.map((gradient, i) => (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br text-white/70 ${gradient}`}
          >
            <CameraIcon className="size-6" />
          </div>
        ))}
      </div>
    </section>
  );
}
