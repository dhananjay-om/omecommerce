import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Product } from "../data/products";

interface CartItem {
  product: Product;
  size: string;
  color: string;
  quantity: number;
}

interface ShopContextType {
  cart: CartItem[];
  wishlist: Product[];
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  addToCart: (product: Product, size: string, color: string, qty?: number) => void;
  removeFromCart: (productId: string, size: string) => void;
  updateQty: (productId: string, size: string, qty: number) => void;
  clearCart: () => void;
  toggleWishlist: (product: Product) => void;
  isWishlisted: (productId: string) => boolean;
  cartCount: number;
  cartTotal: number;
  wishlistCount: number;
}

const ShopContext = createContext<ShopContextType | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("elume_cart") || "[]"); } catch { return []; }
  });
  const [wishlist, setWishlist] = useState<Product[]>(() => {
    try { return JSON.parse(localStorage.getItem("elume_wishlist") || "[]"); } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => { localStorage.setItem("elume_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("elume_wishlist", JSON.stringify(wishlist)); }, [wishlist]);

  // lock body scroll when cart drawer is open
  useEffect(() => {
    document.body.style.overflow = cartOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [cartOpen]);

  function addToCart(product: Product, size: string, color: string, qty = 1) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id && i.size === size);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id && i.size === size ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { product, size, color, quantity: qty }];
    });
    setCartOpen(true);
  }

  function removeFromCart(productId: string, size: string) {
    setCart((prev) => prev.filter((i) => !(i.product.id === productId && i.size === size)));
  }

  function updateQty(productId: string, size: string, qty: number) {
    if (qty < 1) { removeFromCart(productId, size); return; }
    setCart((prev) =>
      prev.map((i) => i.product.id === productId && i.size === size ? { ...i, quantity: qty } : i)
    );
  }

  function clearCart() { setCart([]); }

  function toggleWishlist(product: Product) {
    setWishlist((prev) =>
      prev.find((p) => p.id === product.id) ? prev.filter((p) => p.id !== product.id) : [...prev, product]
    );
  }

  function isWishlisted(productId: string) { return wishlist.some((p) => p.id === productId); }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const wishlistCount = wishlist.length;

  return (
    <ShopContext.Provider value={{
      cart, wishlist, cartOpen, setCartOpen,
      addToCart, removeFromCart, updateQty, clearCart,
      toggleWishlist, isWishlisted, cartCount, cartTotal, wishlistCount,
    }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
}
