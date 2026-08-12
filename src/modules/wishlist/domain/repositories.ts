export interface WishlistInfo {
  id: bigint;
  publicId: string;
  name: string;
}

export interface WishlistRepository {
  create(customerId: bigint, name: string): Promise<WishlistInfo>;
  listByCustomerId(customerId: bigint): Promise<WishlistInfo[]>;
  findByCustomerAndPublicId(customerId: bigint, wishlistPublicId: string): Promise<WishlistInfo | null>;
}

export interface WishlistItemInfo {
  productPublicId: string;
  sku: string;
  name: string | null;
  addedAt: Date;
}

export interface WishlistItemRepository {
  /** Idempotent — adding a product already on the list is a harmless no-op. */
  add(wishlistId: bigint, productId: bigint): Promise<void>;
  /** Returns false if the (wishlist, product) pairing wasn't present. */
  remove(wishlistId: bigint, productId: bigint): Promise<boolean>;
  listByWishlistId(wishlistId: bigint): Promise<WishlistItemInfo[]>;
}

/** Read-only cross-module lookup: does this product exist (own trivial copy, not Catalog's ProductLookup). */
export interface ProductExistenceLookup {
  findByPublicId(publicId: string): Promise<{ id: bigint } | null>;
}

/** Read-only cross-module lookup: resolves a customer's publicId to their internal id (own trivial copy, not Customer module's repository). */
export interface CustomerLookup {
  findIdByPublicId(customerPublicId: string): Promise<bigint | null>;
}
