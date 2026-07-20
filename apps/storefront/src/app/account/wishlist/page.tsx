import { ensureWishlist } from '@/lib/wishlist-server';
import { WishlistList } from '@/components/account/wishlist-list';

export const metadata = { title: 'Wishlist' };

export default async function AccountWishlistPage() {
  const wishlist = await ensureWishlist();
  return <WishlistList initialItems={wishlist.items} />;
}
