/** Matches the reference theme's champagne marquee strip below the hero —
 *  purely presentational/promotional copy, same category as the
 *  announcement bar's own pre-existing hardcoded "Free shipping on orders
 *  over $50" text (not backed by a real settings row). Uses the `marquee`
 *  keyframe already defined in globals.css. */
const ITEMS = ['Free shipping over $50', '30-day easy returns', 'New arrivals every week', 'Genuine products only'];

export function MarqueeStrip() {
  return (
    <div className="overflow-hidden bg-champagne py-3">
      <div className="flex animate-[marquee_18s_linear_infinite] gap-8 whitespace-nowrap">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="flex shrink-0 gap-8 text-xs font-medium tracking-widest text-white uppercase">
            {ITEMS.map((item) => (
              <span key={item} className="flex items-center gap-8">
                <span>{item}</span>
                <span>✦</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
