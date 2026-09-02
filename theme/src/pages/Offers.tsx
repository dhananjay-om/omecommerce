import { useState } from "react";
import { Link } from "react-router";
import ProductCard from "../components/ProductCard";
import { products } from "../data/products";

const deals = [
  { code: "ÉLUME15", off: "15% off", min: "₹2,000", desc: "Sitewide on all categories", expires: "31 Aug 2025" },
  { code: "NEWSTYLE", off: "₹500 off", min: "₹5,000", desc: "New season collections only", expires: "15 Sep 2025" },
  { code: "FREESHIP", off: "Free Shipping", min: "₹1,500", desc: "Free standard delivery", expires: "Ongoing" },
  { code: "FIRST20", off: "20% off", min: "First order", desc: "New customer exclusive", expires: "Ongoing" },
];

const saleBanners = [
  {
    label: "End of Season Sale",
    sub: "Up to 40% off women's styles",
    img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&h=500&fit=crop&auto=format",
    to: "/shop/women",
    accent: "bg-champagne",
  },
  {
    label: "Men's Clearance",
    sub: "Extra 25% off last sizes",
    img: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=900&h=500&fit=crop&auto=format",
    to: "/shop/men",
    accent: "bg-jet",
  },
];

export default function Offers() {
  const [copied, setCopied] = useState<string | null>(null);
  const saleProducts = products.filter((p) => p.discount).sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-jet h-64 sm:h-80 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1400&h=500&fit=crop&auto=format"
          alt="Offers"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <span className="text-xs tracking-[0.3em] uppercase text-champagne font-medium mb-3">Exclusive Savings</span>
          <h1 className="font-display text-5xl sm:text-6xl text-white font-semibold">Sale & Offers</h1>
          <p className="text-white/60 mt-3 text-sm sm:text-base">Handpicked deals on luxury fashion — for a limited time.</p>
        </div>
      </section>

      {/* Coupon codes */}
      <section className="bg-ivory py-12">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-xs tracking-widest uppercase text-slate">Save more with</p>
            <h2 className="font-display text-2xl font-medium text-jet mt-1">Promo Codes</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {deals.map((d) => (
              <div key={d.code} className="bg-white border border-ghost rounded-sm p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-champagne/5 rounded-full -translate-y-8 translate-x-8" />
                <p className="text-2xl font-semibold text-jet font-display">{d.off}</p>
                <p className="text-xs text-slate mt-1">{d.desc}</p>
                <p className="text-xs text-charcoal mt-1">Min. order: <span className="font-medium">{d.min}</span></p>

                <div className="mt-4 flex items-center gap-0 border border-dashed border-champagne rounded-sm overflow-hidden">
                  <span className="flex-1 px-3 py-2 text-xs font-mono font-semibold text-champagne tracking-widest">{d.code}</span>
                  <button
                    onClick={() => copyCode(d.code)}
                    className="px-3 py-2 bg-champagne text-white text-[10px] tracking-widest uppercase font-semibold hover:bg-champagne/90 transition-colors shrink-0"
                  >
                    {copied === d.code ? "✓" : "Copy"}
                  </button>
                </div>

                <p className="text-[10px] text-slate mt-2">Expires: {d.expires}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sale banners */}
      <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {saleBanners.map((b) => (
            <Link
              key={b.label}
              to={b.to}
              className="group relative overflow-hidden rounded-sm h-52 sm:h-64 bg-sand"
            >
              <img
                src={b.img}
                alt={b.label}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
              <div className="relative z-10 h-full flex flex-col justify-end p-7">
                <p className="text-white/70 text-xs tracking-widest uppercase">{b.sub}</p>
                <p className="font-display text-2xl sm:text-3xl text-white font-medium mt-1">{b.label}</p>
                <p className="text-white text-xs tracking-widest uppercase mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  Shop Now →
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Sale products */}
      <section className="bg-ivory py-12">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs tracking-widest uppercase text-slate">Limited time</p>
              <h2 className="font-display text-3xl font-medium text-jet mt-1">On Sale Now</h2>
            </div>
            <div className="text-xs text-slate">
              <span className="text-rose font-semibold">{saleProducts.length} styles</span> on offer
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {saleProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Loyalty CTA */}
      <section className="bg-jet py-14 px-4">
        <div className="max-w-screen-md mx-auto text-center">
          <span className="text-champagne text-xs tracking-[0.3em] uppercase font-medium">Élume Elite</span>
          <h2 className="font-display text-4xl text-white font-medium mt-3">Earn. Redeem. Repeat.</h2>
          <p className="text-white/50 mt-3 text-sm leading-relaxed">
            Join Élume Elite and earn 1 point per ₹100 spent. Redeem for exclusive discounts, early access, and member-only events.
          </p>
          <Link
            to="/account"
            className="inline-block mt-7 border border-champagne text-champagne px-8 py-3 text-xs tracking-widest uppercase font-semibold hover:bg-champagne hover:text-white transition-colors"
          >
            Join for Free
          </Link>
        </div>
      </section>
    </div>
  );
}
