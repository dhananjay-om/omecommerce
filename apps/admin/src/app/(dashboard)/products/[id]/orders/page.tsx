import { ShoppingCart } from 'lucide-react';
import { InlineComingSoon } from '@/components/coming-soon';

export default function ProductOrdersPage() {
  return <InlineComingSoon icon={ShoppingCart} description="A list of orders that include this product isn't built yet — the Orders section in the sidebar has every real order." />;
}
