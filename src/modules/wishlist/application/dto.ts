export interface CreateWishlistCommand {
  customerPublicId: string;
  name?: string;
}

export interface WishlistItemView {
  productId: string;
  sku: string;
  name: string | null;
  addedAt: string;
}

/** GET /me/wishlists returns each wishlist WITH its items nested (plan/05 §2.6: "GET/POST /me/wishlists (+ items)") — no separate items-read endpoint. */
export interface WishlistView {
  publicId: string;
  name: string;
  items: WishlistItemView[];
}

export interface AddWishlistItemCommand {
  customerPublicId: string;
  wishlistPublicId: string;
  productPublicId: string;
}

export interface RemoveWishlistItemCommand {
  customerPublicId: string;
  wishlistPublicId: string;
  productPublicId: string;
}
