import { Link } from "react-router";
import { useShop } from "../context/ShopContext";
import { formatPrice } from "../data/products";

export default function CartDrawer() {
  const { cart, cartOpen, setCartOpen, cartTotal, removeFromCart, updateQty } = useShop();
  const shipping = cartTotal >= 3000 ? 0 : 299;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-50 transition-opacity duration-300 ${cartOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setCartOpen(false)}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white z-50 flex flex-col shadow-2xl transition-transform duration-350 ease-in-out ${cartOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-ghost">
          <div>
            <h2 className="font-semibold text-jet text-base">Your Bag</h2>
            <p className="text-xs text-slate mt-0.5">
              {cart.length === 0 ? "Nothing in here yet" : `${cart.reduce((s, i) => s + i.quantity, 0)} items`}
            </p>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            className="w-8 h-8 rounded-full bg-sand flex items-center justify-center text-charcoal hover:bg-ghost transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Free shipping progress */}
        {cartTotal > 0 && cartTotal < 3000 && (
          <div className="px-6 py-3 bg-ivory border-b border-ghost">
            <div className="flex justify-between text-xs text-slate mb-1.5">
              <span>Add {formatPrice(3000 - cartTotal)} more for free shipping</span>
              <span className="text-champagne font-medium">{Math.round((cartTotal / 3000) * 100)}%</span>
            </div>
            <div className="h-1 bg-ghost rounded-full overflow-hidden">
              <div
                className="h-full bg-champagne rounded-full transition-all duration-500"
                style={{ width: `${Math.min((cartTotal / 3000) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
        {cartTotal >= 3000 && (
          <div className="px-6 py-2.5 bg-champagne/10 border-b border-champagne/20">
            <p className="text-xs text-champagne font-medium text-center">🎉 You've unlocked free shipping!</p>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 bg-sand rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-silver" fill="none" stroke="currentColor" strokeWidth={1.3} viewBox="0 0 24 24">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-jet">Your bag is empty</p>
                <p className="text-sm text-slate mt-1">Time to find something you love.</p>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="mt-2 bg-jet text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors"
              >
                Start shopping
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {cart.map((item) => (
                <div key={`${item.product.id}-${item.size}`} className="flex gap-4">
                  <Link
                    to={`/product/${item.product.id}`}
                    onClick={() => setCartOpen(false)}
                    className="shrink-0 w-20 h-24 bg-sand rounded-xl overflow-hidden"
                  >
                    <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate tracking-widest uppercase">{item.product.brand}</p>
                        <Link
                          to={`/product/${item.product.id}`}
                          onClick={() => setCartOpen(false)}
                          className="text-sm font-medium text-jet hover:text-champagne transition-colors leading-snug line-clamp-2 block mt-0.5"
                        >
                          {item.product.name}
                        </Link>
                        <p className="text-xs text-slate mt-1">{item.size} · {item.color}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id, item.size)}
                        className="text-silver hover:text-rose transition-colors shrink-0 mt-0.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1 bg-sand rounded-full px-1">
                        <button
                          onClick={() => updateQty(item.product.id, item.size, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center text-charcoal hover:text-jet text-sm"
                        >−</button>
                        <span className="text-xs font-semibold text-jet w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.product.id, item.size, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center text-charcoal hover:text-jet text-sm"
                        >+</button>
                      </div>
                      <span className="text-sm font-semibold text-jet">{formatPrice(item.product.price * item.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t border-ghost px-6 py-5 bg-white">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate">Subtotal</span>
              <span className="font-semibold text-jet">{formatPrice(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-sm mb-4">
              <span className="text-slate">Shipping</span>
              <span className={`font-semibold ${shipping === 0 ? "text-champagne" : "text-jet"}`}>
                {shipping === 0 ? "Free" : formatPrice(shipping)}
              </span>
            </div>
            <Link
              to="/checkout"
              onClick={() => setCartOpen(false)}
              className="block w-full bg-jet text-white text-center py-3.5 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors"
            >
              Checkout · {formatPrice(cartTotal + shipping)}
            </Link>
            <Link
              to="/cart"
              onClick={() => setCartOpen(false)}
              className="block w-full text-center py-2.5 text-sm text-slate hover:text-jet transition-colors mt-2"
            >
              View full bag
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
