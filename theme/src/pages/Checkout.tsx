import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useShop } from "../context/ShopContext";
import { formatPrice } from "../data/products";

type Step = "address" | "delivery" | "payment" | "confirmed";

const STEPS: Step[] = ["address", "delivery", "payment"];
const STEP_LABELS: Record<Step, string> = {
  address: "Address", delivery: "Delivery", payment: "Payment", confirmed: "Confirmed",
};

export default function Checkout() {
  const { cart, cartTotal, clearCart } = useShop();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("address");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    address: "", city: "", state: "", pincode: "",
    delivery: "standard", payment: "upi",
    cardNumber: "", cardExpiry: "", cardCvv: "", cardName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const shipping = cartTotal >= 3000 ? 0 : 299;
  const total = cartTotal + shipping;

  if (cart.length === 0 && step !== "confirmed") {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <p className="font-display text-2xl text-jet">Your bag is empty</p>
        <Link to="/shop/women" className="bg-jet text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors">
          Go shopping
        </Link>
      </div>
    );
  }

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); }

  function validateAddress() {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.email.includes("@")) e.email = "Valid email required";
    if (form.phone.length < 10) e.phone = "Valid phone required";
    if (!form.address.trim()) e.address = "Required";
    if (!form.city.trim()) e.city = "Required";
    if (!form.state.trim()) e.state = "Required";
    if (form.pincode.length !== 6) e.pincode = "6-digit pincode required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function placeOrder() {
    clearCart();
    setStep("confirmed");
  }

  if (step === "confirmed") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-4 text-center bg-white">
        <div className="w-20 h-20 bg-champagne/10 rounded-full flex items-center justify-center animate-[fadeUp_0.5s_ease]">
          <svg className="w-9 h-9 text-champagne" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="font-display text-4xl font-semibold text-jet">You're all set!</p>
          <p className="text-slate mt-2 max-w-sm text-sm leading-relaxed">
            Order confirmed. We've sent a confirmation to <strong className="text-jet">{form.email || "your email"}</strong>.
            Expect delivery in 3–5 business days.
          </p>
        </div>
        <div className="bg-[#FAF9F7] rounded-2xl px-8 py-5 border border-ghost">
          <p className="text-xs text-slate uppercase tracking-widest">Order number</p>
          <p className="font-semibold text-jet text-lg mt-1">ELM-{Math.floor(Math.random() * 900000 + 100000)}</p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link to="/" className="border border-ghost px-6 py-3 rounded-full text-sm font-medium text-charcoal hover:border-jet transition-colors">
            Back to Home
          </Link>
          <Link to="/account" className="bg-jet text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors">
            Track My Order
          </Link>
        </div>
      </div>
    );
  }

  const Field = ({ name, label, type = "text", placeholder = label, wide = false }: { name: string; label: string; type?: string; placeholder?: string; wide?: boolean }) => (
    <div className={wide ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-slate mb-1.5">{label}</label>
      <input
        type={type}
        value={(form as any)[name]}
        onChange={(e) => set(name, e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-xl px-4 py-3 text-sm text-jet outline-none transition-colors bg-white ${errors[name] ? "border-rose" : "border-ghost focus:border-champagne"}`}
      />
      {errors[name] && <p className="text-xs text-rose mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">

        {/* Progress */}
        <div className="flex items-center justify-center gap-0 mb-10">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              {i > 0 && (
                <div className={`w-12 sm:w-20 h-px transition-colors ${STEPS.indexOf(step) >= i ? "bg-champagne" : "bg-ghost"}`} />
              )}
              <button
                onClick={() => STEPS.indexOf(step) > i && setStep(s)}
                className="flex flex-col items-center gap-1"
                disabled={STEPS.indexOf(step) <= i}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s ? "bg-jet text-white shadow-md" :
                  STEPS.indexOf(step) > i ? "bg-champagne text-white" : "bg-ghost text-slate"
                }`}>
                  {STEPS.indexOf(step) > i ? "✓" : i + 1}
                </span>
                <span className={`text-[10px] font-medium hidden sm:block ${step === s ? "text-jet" : "text-slate"}`}>{STEP_LABELS[s]}</span>
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Form */}
          <div className="lg:col-span-3">
            {/* ADDRESS */}
            {step === "address" && (
              <div>
                <h2 className="font-display text-2xl font-semibold text-jet mb-6">Where should we send it?</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field name="firstName" label="First Name" placeholder="Priya" />
                  <Field name="lastName" label="Last Name" placeholder="Sharma" />
                  <Field name="email" label="Email Address" type="email" placeholder="priya@email.com" wide />
                  <Field name="phone" label="Phone Number" type="tel" placeholder="98765 43210" wide />
                  <Field name="address" label="Street Address" placeholder="42, Primrose Lane, Bandra West" wide />
                  <Field name="city" label="City" placeholder="Mumbai" />
                  <Field name="state" label="State" placeholder="Maharashtra" />
                  <Field name="pincode" label="Pincode" placeholder="400050" />
                </div>
                <button
                  onClick={() => { if (validateAddress()) setStep("delivery"); }}
                  className="mt-7 bg-jet text-white px-8 py-3.5 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors"
                >
                  Continue to Delivery →
                </button>
              </div>
            )}

            {/* DELIVERY */}
            {step === "delivery" && (
              <div>
                <h2 className="font-display text-2xl font-semibold text-jet mb-6">How fast do you need it?</h2>
                <div className="flex flex-col gap-3">
                  {[
                    { id: "standard", label: "Standard Delivery", sub: "3–5 business days", price: shipping === 0 ? "Free" : formatPrice(299), badge: shipping === 0 ? "🎉 Free for you!" : "" },
                    { id: "express", label: "Express Delivery", sub: "1–2 business days", price: formatPrice(499), badge: "" },
                    { id: "same-day", label: "Same Day", sub: "Order before 12pm · Select cities", price: formatPrice(699), badge: "Fastest" },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-4 border-2 rounded-2xl p-4 cursor-pointer transition-all ${form.delivery === opt.id ? "border-jet bg-[#FAF9F7]" : "border-ghost hover:border-silver"}`}
                    >
                      <input type="radio" name="delivery" value={opt.id} checked={form.delivery === opt.id}
                        onChange={(e) => set("delivery", e.target.value)} className="accent-jet" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-jet">{opt.label}</p>
                          {opt.badge && <span className="text-[10px] bg-champagne/10 text-champagne px-2 py-0.5 rounded-full font-medium">{opt.badge}</span>}
                        </div>
                        <p className="text-xs text-slate mt-0.5">{opt.sub}</p>
                      </div>
                      <span className="text-sm font-bold text-jet shrink-0">{opt.price}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3 mt-7">
                  <button onClick={() => setStep("address")} className="border border-ghost px-5 py-3 rounded-full text-sm font-medium text-charcoal hover:border-jet transition-colors">← Back</button>
                  <button onClick={() => setStep("payment")} className="bg-jet text-white px-8 py-3 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors">Continue to Payment →</button>
                </div>
              </div>
            )}

            {/* PAYMENT */}
            {step === "payment" && (
              <div>
                <h2 className="font-display text-2xl font-semibold text-jet mb-6">How would you like to pay?</h2>
                <div className="flex flex-col gap-3 mb-6">
                  {[
                    { id: "upi", label: "UPI", sub: "GPay, PhonePe, Paytm, BHIM", icon: "📱" },
                    { id: "card", label: "Credit / Debit Card", sub: "Visa, Mastercard, RuPay", icon: "💳" },
                    { id: "netbanking", label: "Net Banking", sub: "All major banks supported", icon: "🏦" },
                    { id: "cod", label: "Cash on Delivery", sub: "Pay when it arrives", icon: "💵" },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 border-2 rounded-2xl p-4 cursor-pointer transition-all ${form.payment === opt.id ? "border-jet bg-[#FAF9F7]" : "border-ghost hover:border-silver"}`}
                    >
                      <input type="radio" name="payment" value={opt.id} checked={form.payment === opt.id}
                        onChange={(e) => set("payment", e.target.value)} className="accent-jet" />
                      <span className="text-xl">{opt.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-jet">{opt.label}</p>
                        <p className="text-xs text-slate mt-0.5">{opt.sub}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {form.payment === "card" && (
                  <div className="bg-[#FAF9F7] rounded-2xl p-5 mb-5 grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate block mb-1.5">Card Number</label>
                      <input value={form.cardNumber} onChange={(e) => set("cardNumber", e.target.value)}
                        className="w-full border border-ghost rounded-xl px-4 py-3 text-sm outline-none focus:border-champagne bg-white" placeholder="1234 5678 9012 3456" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate block mb-1.5">Name on Card</label>
                      <input value={form.cardName} onChange={(e) => set("cardName", e.target.value)}
                        className="w-full border border-ghost rounded-xl px-4 py-3 text-sm outline-none focus:border-champagne bg-white" placeholder="Priya Sharma" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate block mb-1.5">Expiry</label>
                      <input value={form.cardExpiry} onChange={(e) => set("cardExpiry", e.target.value)}
                        className="w-full border border-ghost rounded-xl px-4 py-3 text-sm outline-none focus:border-champagne bg-white" placeholder="MM / YY" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate block mb-1.5">CVV</label>
                      <input value={form.cardCvv} onChange={(e) => set("cardCvv", e.target.value)} type="password"
                        className="w-full border border-ghost rounded-xl px-4 py-3 text-sm outline-none focus:border-champagne bg-white" placeholder="•••" />
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep("delivery")} className="border border-ghost px-5 py-3 rounded-full text-sm font-medium text-charcoal hover:border-jet transition-colors">← Back</button>
                  <button
                    onClick={placeOrder}
                    className="flex-1 bg-jet text-white py-3.5 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors"
                  >
                    Place Order · {formatPrice(total)}
                  </button>
                </div>
                <p className="text-xs text-slate text-center mt-3 flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Your payment info is always encrypted and secure
                </p>
              </div>
            )}
          </div>

          {/* Summary sidebar */}
          <div className="lg:col-span-2">
            <div className="bg-[#FAF9F7] rounded-2xl p-6 sticky top-24">
              <h3 className="font-semibold text-jet mb-4">Order Summary</h3>
              <div className="flex flex-col gap-3 mb-5 max-h-56 overflow-y-auto">
                {cart.map((item) => (
                  <div key={`${item.product.id}-${item.size}`} className="flex gap-3 items-center">
                    <div className="relative shrink-0">
                      <div className="w-14 h-16 rounded-xl overflow-hidden bg-sand">
                        <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-jet text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-jet leading-snug line-clamp-2">{item.product.name}</p>
                      <p className="text-[10px] text-slate mt-0.5">{item.size}</p>
                    </div>
                    <p className="text-xs font-bold text-jet shrink-0">{formatPrice(item.product.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-ghost pt-4 flex flex-col gap-2.5 text-sm">
                <div className="flex justify-between"><span className="text-slate">Subtotal</span><span className="font-medium">{formatPrice(cartTotal)}</span></div>
                <div className="flex justify-between">
                  <span className="text-slate">Shipping</span>
                  <span className={`font-medium ${shipping === 0 ? "text-champagne" : ""}`}>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
                </div>
                <div className="border-t border-ghost pt-2.5 flex justify-between font-bold text-base">
                  <span>Total</span><span>{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
