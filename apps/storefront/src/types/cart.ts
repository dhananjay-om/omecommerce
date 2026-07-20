export interface CartLine {
  id: string;
  variantId: string;
  qty: number;
}

export interface Cart {
  publicId: string;
  currency: string;
  status: string;
  lines: CartLine[];
}
