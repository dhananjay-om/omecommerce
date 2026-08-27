import { TruckIcon, ShieldCheckIcon, ArrowPathIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

/** Fixed allowlist matching the admin's ICON_OPTIONS (content/home-page/section-fields.ts)
 *  — icon components obviously can't be stored in the DB, so the block only
 *  stores this key. Falls back to the truck icon for anything unrecognized. */
const ICON_COMPONENTS = {
  truck: TruckIcon,
  shield: ShieldCheckIcon,
  refresh: ArrowPathIcon,
  chat: ChatBubbleLeftRightIcon,
} as const;

/** Default 4 trust badges, shown when the admin hasn't set anything under
 *  Content > Home Page — see hero-banner.tsx's matching doc comment. */
const DEFAULT_FEATURES: Feature[] = [
  { icon: 'truck', title: 'Free Shipping', description: 'On all orders over $50' },
  { icon: 'shield', title: 'Secure Payment', description: '100% secure checkout' },
  { icon: 'refresh', title: 'Easy Returns', description: '30-day return policy' },
  { icon: 'chat', title: '24/7 Support', description: 'Dedicated customer care' },
];

export function WhyChooseUs({ features }: { features?: Feature[] }) {
  const activeFeatures = features && features.length > 0 ? features : DEFAULT_FEATURES;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {activeFeatures.map((feature, i) => {
          const Icon = ICON_COMPONENTS[feature.icon as keyof typeof ICON_COMPONENTS] ?? TruckIcon;
          return (
            <div key={i} className="flex flex-col items-center gap-3 rounded-2xl bg-ivory p-6 text-center">
              <Icon className="size-7 text-champagne" />
              <span className="text-sm font-semibold text-jet">{feature.title}</span>
              <span className="text-xs text-slate">{feature.description}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
