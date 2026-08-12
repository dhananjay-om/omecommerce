export interface CartLine {
  id: string;
  variantId: string;
  qty: number;
  sku: string;
  name: string;
  price: string | null;
  imageUrl: string | null;
  lineTotal: string | null;
}

export interface Cart {
  publicId: string;
  currency: string;
  status: string;
  lines: CartLine[];
  subtotal: string | null;
}
