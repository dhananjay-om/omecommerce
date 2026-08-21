export interface Customer {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface CustomerAddress {
  publicId: string;
  name: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface CustomerOrderListItem {
  publicId: string;
  orderNumber: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  grandTotal: string;
  currency: string;
  placedAt: string;
  itemsCount: number;
}

export interface CustomerOrderList {
  total: number;
  page: number;
  pageSize: number;
  orders: CustomerOrderListItem[];
}

export interface SessionInfo {
  isLoggedIn: boolean;
  firstName?: string | null;
}

export interface WishlistItem {
  productId: string;
  sku: string;
  /** Canonical storefront URL is /{slug}.html. */
  slug: string;
  name: string | null;
  addedAt: string;
}

export interface Wishlist {
  publicId: string;
  name: string;
  items: WishlistItem[];
}
