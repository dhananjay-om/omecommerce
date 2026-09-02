import { Link } from "react-router";
import { useShop } from "../context/ShopContext";
import { formatPrice } from "../data/products";
import { useState } from "react";

export default function Cart() {
  const { cart, removeFromCart, updateQty, cartTotal } = useShop();
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState(false);

  const shipping = cartTotal >= 3000 ? 0 : 299;
  const discount = promoApplied ? Math.round(cartTotal * 0.15) : 0;
  const total = cartTotal - discount + shipping;

  function applyPromo() {
    if (promoCode.toUpperCase() === "ÉLUME15" || promoCode.toUpperCase() === "ELUME15") {
      setPromoApplied(true); setPromoError(false);
    } else {
      setPromoError(true); setPromoApplied(false);
    }
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-5 px-4">
        <div className="w-24 h-24 bg-[#FAF9F7] rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-silver" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <div className="text-center">
          <p className="font-display text-2xl font-semibold text-jet">Your bag is empty</p>
          <p className="text-slate text-sm mt-2">Looks like you haven't added anything yet.</p>
        </div>
        <Link to="/shop/women" className="bg-jet text-white px-8 py-3.5 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors">
          Start shopping
        </Link>
        <div className="flex gap-3 mt-2">
          {["Women", "Men", "Accessories"].map((c) => (
            <Link key={c} to={`/shop/${c.toLowerCase()}`} className="text-xs text-champagne hover:text-jet transition-colors">{c}</Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-jet">
            Your Bag
            <span className="text-slate text-xl font-normal ml-3">({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-12">
          {/* Items */}
          <div className="lg:col-span-2">
            {/* Free shipping bar */}
            {cartTotal < 3000 && (
              <div className="bg-[#FAF9F7] rounded-2xl p-4 mb-6 border border-ghost">
                <div className="flex justify-between text-xs text-charcoal mb-2">
                  <span>Add <strong>{formatPrice(3000 - cartTotal)}</strong> more to unlock free shipping</span>
                  <span className="text-champagne font-semibold">{Math.round((cartTotal / 3000) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-ghost rounded-full">
                  <div className="h-full bg-champagne rounded-full transition-all" style={{ width: `${Math.min((cartTotal / 3000) * 100, 100)}%` }} />
                </div>
              </div>
            )}
            {cartTotal >= 3000 && (
              <div className="bg-champagne/10 border border-champagne/30 rounded-2xl p-3 mb-6 text-center text-sm text-champagne font-medium">
                🎉 You've got free shipping!
              </div>
            )}

            <div className="flex flex-col divide-y divide-ghost">
              {cart.map((item) => (
                <div key={`${item.product.id}-${item.size}`} className="py-6 flex gap-5">
                  <Link to={`/product/${item.product.id}`} className="shrink-0 w-28 h-36 rounded-2xl overflow-hidden bg-[#FAF9F7]">
                    <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] tracking-widest text-slate uppercase">{item.product.brand}</p>
                        <Link to={`/product/${item.product.id}`}>
                          <h3 className="text-sm sm:text-base font-semibold text-jet mt-0.5 hover:text-champagne transition-colors leading-snug">{item.product.name}</h3>
                        </Link>
                        <div className="flex gap-2 mt-1.5">
                          <span className="text-xs bg-sand px-2.5 py-0.5 rounded-full text-charcoal">Size: {item.size}</span>
                          <span className="text-xs bg-sand px-2.5 py-0.5 rounded-full text-charcoal">{item.color}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id, item.size)}
                        className="text-silver hover:text-rose transition-colors shrink-0 w-7 h-7 rounded-full hover:bg-rose/10 flex items-center justify-center"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2">
                      <div className="flex items-center bg-[#FAF9F7] rounded-xl border border-ghost">
                        <button onClick={() => updateQty(item.product.id, item.size, item.quantity - 1)} className="w-9 h-9 flex items-center justify-center text-charcoal hover:text-jet text-lg">−</button>
                        <span className="w-7 text-center text-sm font-semibold text-jet">{item.quantity}</span>
                        <button onClick={() => updateQty(item.product.id, item.size, item.quantity + 1)} className="w-9 h-9 flex items-center justify-center text-charcoal hover:text-jet text-lg">+</button>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-jet">{formatPrice(item.product.price * item.quantity)}</p>
                        {item.quantity > 1 && <p className="text-xs text-slate">{formatPrice(item.product.price)} each</p>}
                        {item.product.originalPrice && (
                          <p className="text-xs text-rose font-medium">{item.product.discount}% off</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-[#FAF9F7] rounded-2xl p-6 sticky top-24">
              <h2 className="font-semibold text-jet mb-5">Order Summary</h2>

              {/* Promo */}
              {!promoApplied ? (
                <div className="mb-5">
                  <div className="flex gap-0 rounded-xl overflow-hidden border border-ghost bg-white">
                    <input
                      value={promoCode}
                      onChange={(e) => { setPromoCode(e.target.value); setPromoError(false); }}
                      placeholder="Promo code"
                      className="flex-1 px-4 py-2.5 text-sm text-jet outline-none bg-transparent"
                      onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                    />
                    <button onClick={applyPromo} className="bg-jet text-white px-4 py-2.5 text-xs font-semibold hover:bg-charcoal transition-colors shrink-0">
                      Apply
                    </button>
                  </div>
                  {promoError && <p className="text-xs text-rose mt-1.5">That code doesn't seem right. Try ÉLUME15.</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between bg-champagne/10 border border-champagne/30 rounded-xl px-4 py-2.5 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-champagne">✓</span>
                    <span className="text-sm font-medium text-champagne">ÉLUME15 applied</span>
                  </div>
                  <button onClick={() => { setPromoApplied(false); setPromoCode(""); }} className="text-xs text-slate hover:text-rose transition-colors">Remove</button>
                </div>
              )}

              <div className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate">Subtotal</span>
                  <span className="font-medium text-jet">{formatPrice(cartTotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-champagne">Promo discount</span>
                    <span className="font-medium text-champagne">− {formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate">Shipping</span>
                  <span className={`font-medium ${shipping === 0 ? "text-champagne" : "text-jet"}`}>
                    {shipping === 0 ? "Free 🎉" : formatPrice(shipping)}
                  </span>
                </div>
                <div className="border-t border-ghost pt-3 flex justify-between font-bold text-base">
                  <span className="text-jet">Total</span>
                  <span className="text-jet">{formatPrice(total)}</span>
                </div>
              </div>

              <Link
                to="/checkout"
                className="mt-5 flex items-center justify-center gap-2 w-full bg-jet text-white py-3.5 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors"
              >
                Checkout securely →
              </Link>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                SSL encrypted · 256-bit secure checkout
              </div>

              <div className="mt-5 pt-4 border-t border-ghost">
                <p className="text-xs text-slate text-center mb-3">Accepted payment methods</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {["Visa", "Mastercard", "RuPay", "UPI", "Net Banking", "COD"].map((m) => (
                    <span key={m} className="bg-white border border-ghost text-[10px] font-medium text-charcoal px-2 py-1 rounded-lg">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
