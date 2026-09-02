import { useState } from "react";
import { useParams, Link } from "react-router";
import { getProductById, products, formatPrice } from "../data/products";
import { useShop } from "../context/ShopContext";
import ProductCard from "../components/ProductCard";

export default function ProductDetail() {
  const { id } = useParams();
  const product = getProductById(id ?? "");
  const { addToCart, toggleWishlist, isWishlisted } = useShop();

  const [activeImg, setActiveImg] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState(product?.colors[0]?.name ?? "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const [openTab, setOpenTab] = useState<"details" | "shipping" | "returns">("details");

  if (!product) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <p className="font-display text-2xl text-jet">Hmm, we can't find that one.</p>
        <Link to="/shop/women" className="text-sm text-champagne hover:text-jet transition-colors">← Back to shop</Link>
      </div>
    );
  }

  const wishlisted = isWishlisted(product.id);
  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  function handleAddToCart() {
    if (!selectedSize) { setSizeError(true); return; }
    setSizeError(false);
    addToCart(product!, selectedSize, selectedColor, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  const savings = product.originalPrice ? product.originalPrice - product.price : 0;

  return (
    <div className="bg-white">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        {/* Breadcrumb */}
        <nav className="flex gap-2 text-xs text-slate mb-8 flex-wrap">
          <Link to="/" className="hover:text-jet transition-colors">Home</Link>
          <span>/</span>
          <Link to={`/shop/${product.category}`} className="hover:text-jet transition-colors capitalize">{product.category}</Link>
          <span>/</span>
          <Link to={`/shop/${product.category}/${product.subcategory}`} className="hover:text-jet transition-colors capitalize">{product.subcategory}</Link>
          <span>/</span>
          <span className="text-jet truncate max-w-[160px]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-14">

          {/* ── GALLERY ── */}
          <div className="flex gap-3">
            {/* Thumbnails */}
            <div className="flex flex-col gap-2 shrink-0">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`w-16 h-20 sm:w-20 sm:h-24 overflow-hidden rounded-xl bg-[#FAF9F7] border-2 transition-all ${activeImg === i ? "border-jet shadow-sm scale-[1.03]" : "border-transparent hover:border-silver"}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Main */}
            <div className="flex-1 min-w-0">
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[#FAF9F7]">
                <img
                  src={product.images[activeImg]}
                  alt={product.name}
                  className="w-full h-full object-cover object-top transition-opacity duration-200"
                />
                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                  {product.isNew && <span className="bg-jet text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">New in</span>}
                  {product.discount && <span className="bg-rose text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">{product.discount}% off</span>}
                </div>
                {/* Wishlist */}
                <button
                  onClick={() => toggleWishlist(product)}
                  className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-all ${wishlisted ? "bg-rose text-white" : "bg-white text-charcoal hover:bg-rose hover:text-white"}`}
                >
                  <svg className="w-4 h-4" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── DETAILS ── */}
          <div className="flex flex-col">
            {/* Brand + name */}
            <div>
              <span className="text-xs tracking-widest text-slate uppercase font-medium">{product.brand}</span>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-jet mt-1.5 leading-tight">{product.name}</h1>

              {/* Rating row */}
              <div className="flex items-center gap-3 mt-3">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={`text-sm ${i < Math.round(product.rating) ? "text-champagne" : "text-ghost"}`}>★</span>
                  ))}
                </div>
                <span className="text-xs text-slate">{product.rating} · {product.reviews} reviews</span>
              </div>
            </div>

            {/* Price block */}
            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-3xl font-bold text-jet">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <span className="text-base text-slate line-through">{formatPrice(product.originalPrice)}</span>
              )}
              {savings > 0 && (
                <span className="text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  You save {formatPrice(savings)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate mt-1">Inclusive of all taxes · Free returns within 30 days</p>

            <div className="border-t border-ghost mt-6 pt-6 flex flex-col gap-5">
              {/* Colour */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-jet mb-3">
                  Colour — <span className="font-normal text-charcoal normal-case tracking-normal">{selectedColor}</span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      title={c.name}
                      onClick={() => setSelectedColor(c.name)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor === c.name ? "border-jet scale-110 shadow-md" : "border-transparent hover:border-silver"}`}
                      style={{ backgroundColor: c.hex, outline: selectedColor === c.name ? "2px solid #F5F0E8" : "none", outlineOffset: "2px" }}
                    />
                  ))}
                </div>
              </div>

              {/* Size */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-jet">Size</p>
                  <button className="text-xs text-champagne hover:text-jet transition-colors font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    Size guide
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSelectedSize(s); setSizeError(false); }}
                      className={`min-w-[48px] h-11 px-3 rounded-xl text-sm font-medium border transition-all ${
                        selectedSize === s
                          ? "bg-jet text-white border-jet shadow-sm"
                          : "border-ghost text-charcoal hover:border-charcoal bg-white"
                      }`}
                    >{s}</button>
                  ))}
                </div>
                {sizeError && (
                  <p className="text-xs text-rose mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    Please pick a size first
                  </p>
                )}
              </div>

              {/* Qty + CTA */}
              <div className="flex gap-3">
                <div className="flex items-center gap-0 bg-[#FAF9F7] rounded-xl border border-ghost">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-11 h-12 flex items-center justify-center text-charcoal hover:text-jet transition-colors text-xl">−</button>
                  <span className="w-8 text-center text-sm font-semibold text-jet">{qty}</span>
                  <button onClick={() => setQty((q) => q + 1)} className="w-11 h-12 flex items-center justify-center text-charcoal hover:text-jet transition-colors text-xl">+</button>
                </div>

                <button
                  onClick={handleAddToCart}
                  className={`flex-1 h-12 rounded-xl text-sm font-semibold transition-all ${
                    added ? "bg-champagne text-white" : "bg-jet text-white hover:bg-charcoal"
                  }`}
                >
                  {added ? "✓ Added to bag!" : "Add to Bag"}
                </button>

                <button
                  onClick={() => toggleWishlist(product)}
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all ${
                    wishlisted ? "border-rose bg-rose/5 text-rose" : "border-ghost text-charcoal hover:border-rose hover:text-rose"
                  }`}
                >
                  <svg className="w-5 h-5" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 mt-5">
              {[
                { icon: "🚚", label: "Free shipping", sub: "over ₹3,000" },
                { icon: "↩", label: "30-day returns", sub: "no questions" },
                { icon: "✓", label: "100% authentic", sub: "guaranteed" },
              ].map((b) => (
                <div key={b.label} className="bg-[#FAF9F7] rounded-xl p-3 text-center">
                  <div className="text-lg mb-1">{b.icon}</div>
                  <p className="text-[11px] font-semibold text-jet leading-tight">{b.label}</p>
                  <p className="text-[10px] text-slate mt-0.5">{b.sub}</p>
                </div>
              ))}
            </div>

            {/* Info tabs */}
            <div className="mt-6 border border-ghost rounded-2xl overflow-hidden">
              <div className="flex border-b border-ghost">
                {(["details", "shipping", "returns"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setOpenTab(tab)}
                    className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${openTab === tab ? "bg-jet text-white" : "text-slate hover:text-jet"}`}
                  >
                    {tab === "details" ? "Details" : tab === "shipping" ? "Shipping" : "Returns"}
                  </button>
                ))}
              </div>
              <div className="p-5">
                {openTab === "details" && (
                  <div>
                    <p className="text-sm text-charcoal leading-relaxed mb-4">{product.description}</p>
                    <ul className="flex flex-col gap-2">
                      {product.details.map((d) => (
                        <li key={d} className="flex items-start gap-2 text-sm text-charcoal">
                          <span className="text-champagne shrink-0 mt-0.5">·</span>{d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {openTab === "shipping" && (
                  <ul className="flex flex-col gap-2.5">
                    {["Free standard delivery on orders above ₹3,000", "Express delivery (1–2 days) available at checkout", "International shipping to 30+ countries", "Orders placed before 2pm ship same day"].map((l) => (
                      <li key={l} className="flex items-start gap-2 text-sm text-charcoal">
                        <span className="text-champagne shrink-0 mt-0.5">·</span>{l}
                      </li>
                    ))}
                  </ul>
                )}
                {openTab === "returns" && (
                  <ul className="flex flex-col gap-2.5">
                    {["Free returns within 30 days of delivery", "Item must be unworn, unwashed, with tags", "Start a return from your account anytime", "Refund processed within 5 working days"].map((l) => (
                      <li key={l} className="flex items-start gap-2 text-sm text-charcoal">
                        <span className="text-champagne shrink-0 mt-0.5">·</span>{l}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── YOU MAY ALSO LIKE ── */}
        {related.length > 0 && (
          <section className="mt-16 pt-12 border-t border-ghost">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-slate text-xs tracking-widest uppercase">Based on what you're looking at</p>
                <h2 className="font-display text-2xl font-semibold text-jet mt-1">You might also like</h2>
              </div>
              <Link to={`/shop/${product.category}`} className="text-sm text-champagne font-medium hover:text-jet transition-colors hidden sm:block">
                See all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>

      {/* Mobile sticky bar */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t border-ghost lg:hidden z-40 flex gap-3 shadow-lg">
        <button
          onClick={() => toggleWishlist(product)}
          className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${wishlisted ? "border-rose text-rose" : "border-ghost text-charcoal"}`}
        >
          <svg className="w-5 h-5" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <button
          onClick={handleAddToCart}
          className={`flex-1 h-12 rounded-xl text-sm font-semibold transition-all ${added ? "bg-champagne text-white" : "bg-jet text-white"}`}
        >
          {added ? "✓ Added!" : `Add to Bag · ${formatPrice(product.price)}`}
        </button>
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  );
}
