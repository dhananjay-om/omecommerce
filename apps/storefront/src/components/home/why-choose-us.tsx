import { TruckIcon, ShieldCheckIcon, ArrowPathIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

const FEATURES = [
  { icon: TruckIcon, title: 'Free Shipping', description: 'On all orders over $50' },
  { icon: ShieldCheckIcon, title: 'Secure Payment', description: '100% secure checkout' },
  { icon: ArrowPathIcon, title: 'Easy Returns', description: '30-day return policy' },
  { icon: ChatBubbleLeftRightIcon, title: '24/7 Support', description: 'Dedicated customer care' },
];

export function WhyChooseUs() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="flex flex-col items-center gap-2 text-center">
            <feature.icon className="size-8 text-primary" />
            <span className="text-sm font-semibold">{feature.title}</span>
            <span className="text-xs text-muted-foreground">{feature.description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
