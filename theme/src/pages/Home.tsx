import { useState, useEffect } from "react";
import { Link } from "react-router";
import ProductCard from "../components/ProductCard";
import { products } from "../data/products";

const heroSlides = [
  {
    id: 1,
    tag: "Summer Collection 2026",
    headline: "Dressed\nfor real\nlife.",
    sub: "New pieces that fit into your day — not just the photoshoot.",
    cta: "Shop Women",
    ctaLink: "/shop/women",
    img: "https://images.unsplash.com/photo-1533659828870-95ee305cee3e?w=1800&h=1000&fit=crop&auto=format",
    accent: "#C9A96E",
    align: "left",
  },
  {
    id: 2,
    tag: "For the Guys",
    headline: "Looks\ngood.\nFeels easy.",
    sub: "Relaxed pieces with just enough polish for any occasion.",
    cta: "Shop Men",
    ctaLink: "/shop/men",
    img: "https://images.unsplash.com/photo-1628375385879-b476587214ef?w=1800&h=1000&fit=crop&auto=format",
    accent: "#C9A96E",
    align: "right",
  },
  {
    id: 3,
    tag: "The Finishing Touch",
    headline: "It's all\nin the\ndetails.",
    sub: "The right bag. The right shoes. Small things that change everything.",
    cta: "Shop Accessories",
    ctaLink: "/shop/accessories",
    img: "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=1800&h=1000&fit=crop&auto=format",
    accent: "#C9A96E",
    align: "left",
  },
];

const shopCategories = [
  {
    label: "Dresses",
    to: "/shop/women/dresses",
    img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&h=500&fit=crop&auto=format",
    color: "#F5ECE2",
  },
  {
    label: "Tops",
    to: "/shop/women/tops",
    img: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=500&h=500&fit=crop&auto=format",
    color: "#EAE4DA",
  },
  {
    label: "Outerwear",
    to: "/shop/women/outerwear",
    img: "https://images.unsplash.com/photo-1580478491436-fd6a937acc9e?w=500&h=500&fit=crop&auto=format",
    color: "#E8DFD4",
  },
  {
    label: "Bags",
    to: "/shop/accessories/bags",
    img: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&h=500&fit=crop&auto=format",
    color: "#EDE4D6",
  },
  {
    label: "Shoes",
    to: "/shop/accessories/shoes",
    img: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=500&h=500&fit=crop&auto=format",
    color: "#E4DDD4",
  },
  {
    label: "Men",
    to: "/shop/men",
    img: "https://images.unsplash.com/photo-1626557981101-aae6f84aa6ff?w=500&h=500&fit=crop&auto=format",
    color: "#DDD8D0",
  },
];

const collectionBanners = [
  {
    label: "Summer Whites",
    desc: "Effortless linen & cotton pieces for warm days",
    cta: "Explore",
    to: "/shop/women",
    img: "https://images.unsplash.com/photo-1659522761084-79196b64abe4?w=700&h=500&fit=crop&auto=format",
    dark: false,
  },
  {
    label: "New Men's Edit",
    desc: "Sharp, easy-wearing pieces from top brands",
    cta: "Shop now",
    to: "/shop/men",
    img: "https://images.unsplash.com/photo-1626557981101-aae6f84aa6ff?w=700&h=500&fit=crop&auto=format",
    dark: true,
  },
  {
    label: "Up to 40% Off",
    desc: "Great pieces at honest prices — no gimmicks",
    cta: "Browse sale",
    to: "/offers",
    img: "https://images.unsplash.com/photo-1613915617430-8ab0fd7c6baf?w=700&h=500&fit=crop&auto=format",
    dark: true,
  },
];

export default function Home() {
  const [slide, setSlide] = useState(0);
  const [fading, setFading] = useState(false);
  const bestsellers = products.filter((p) => p.isBestseller).slice(0, 4);
  const newArrivals = products.filter((p) => p.isNew).slice(0, 4);

  useEffect(() => {
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setSlide((s) => (s + 1) % heroSlides.length);
        setFading(false);
      }, 400);
    }, 5800);
    return () => clearInterval(t);
  }, []);

  function goSlide(i: number) {
    if (i === slide) return;
    setFading(true);
    setTimeout(() => { setSlide(i); setFading(false); }, 400);
  }

  const s = heroSlides[slide];

  return (
    <div className="bg-white">

      {/* ── HERO ── */}
      <section className="relative h-[92vh] min-h-[600px] overflow-hidden">

        {/* Background image */}
        <div className={`absolute inset-0 transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}>
          <img
            src={s.img}
            alt=""
            className="w-full h-full object-cover object-center"
          />
          {/* Rich layered gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
          {s.align === "left"
            ? <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" />
            : <div className="absolute inset-0 bg-gradient-to-l from-black/50 via-black/10 to-transparent" />
          }
        </div>

        {/* Slide counter — top right */}
        <div className="absolute top-8 right-8 z-10 flex items-center gap-2">
          <span className={`text-white/80 text-sm font-light tabular-nums transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}>
            0{slide + 1} / 0{heroSlides.length}
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex items-end">
          <div className="max-w-screen-xl w-full mx-auto px-6 sm:px-10 pb-16 sm:pb-20 flex flex-col sm:flex-row items-end justify-between gap-8">

            {/* Main text */}
            <div className={`transition-all duration-500 ${fading ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px w-10 bg-champagne" />
                <span className="text-champagne text-xs tracking-[0.2em] uppercase font-medium">{s.tag}</span>
              </div>
              <h1 className="font-display text-[clamp(3rem,9vw,7rem)] font-semibold text-white leading-[0.95] whitespace-pre-line">
                {s.headline}
              </h1>
              <p className="text-white/65 mt-5 text-sm sm:text-base max-w-xs leading-relaxed">
                {s.sub}
              </p>
              <div className="flex items-center gap-4 mt-7">
                <Link
                  to={s.ctaLink}
                  className="bg-white text-jet px-7 py-3.5 text-sm font-semibold rounded-full hover:bg-champagne hover:text-white transition-all duration-300 shadow-lg"
                >
                  {s.cta}
                </Link>
                <Link
                  to="/offers"
                  className="text-white/80 text-sm font-medium hover:text-white transition-colors underline underline-offset-4 decoration-white/30 hover:decoration-white"
                >
                  View sale
                </Link>
              </div>
            </div>

            {/* Side badges — desktop */}
            <div className={`hidden sm:flex flex-col gap-3 items-end transition-all duration-500 delay-100 ${fading ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-3 text-right">
                <p className="text-white/50 text-[10px] tracking-widest uppercase">Free shipping</p>
                <p className="text-white font-semibold text-sm mt-0.5">On orders over ₹3,000</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-3 text-right">
                <p className="text-white/50 text-[10px] tracking-widest uppercase">Easy returns</p>
                <p className="text-white font-semibold text-sm mt-0.5">30-day hassle free</p>
              </div>
            </div>
          </div>
        </div>

        {/* Slide dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => goSlide(i)}
              className={`rounded-full transition-all duration-300 ${i === slide ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/35 hover:bg-white/60"}`}
            />
          ))}
        </div>

        {/* Vertical text label */}
        <div className="absolute left-5 top-1/2 -translate-y-1/2 z-10 hidden xl:flex flex-col items-center gap-3">
          <div className="h-12 w-px bg-white/25" />
          <span className="text-white/40 text-[10px] tracking-[0.25em] uppercase writing-mode-vertical rotate-180" style={{ writingMode: "vertical-rl" }}>
            Scroll to explore
          </span>
        </div>
      </section>

      {/* ── MARQUEE STRIP ── */}
      <div className="bg-champagne overflow-hidden py-3">
        <div className="flex gap-8 animate-[marquee_18s_linear_infinite] whitespace-nowrap">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="text-white text-xs tracking-widest uppercase font-medium shrink-0 flex gap-8">
              <span>Free shipping over ₹3,000</span>
              <span>✦</span>
              <span>30-day easy returns</span>
              <span>✦</span>
              <span>New arrivals every week</span>
              <span>✦</span>
              <span>Code ELUME15 for 15% off</span>
              <span>✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── SHOP BY CATEGORY ── */}
      <section className="py-16 sm:py-20 bg-[#FAF9F7]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-champagne text-xs tracking-[0.2em] uppercase font-medium">Start exploring</p>
            <h2 className="font-display text-4xl font-semibold text-jet mt-2">Shop by Category</h2>
            <p className="text-slate text-sm mt-2">Everything you need, right where you want it.</p>
          </div>

          <div className="flex gap-4 sm:gap-6 lg:gap-10 justify-center flex-nowrap overflow-x-auto pb-2 scrollbar-hide">
            {shopCategories.map((cat, i) => (
              <Link
                key={cat.label}
                to={cat.to}
                className="group flex flex-col items-center gap-3"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 shrink-0 rounded-full overflow-hidden shadow-md group-hover:shadow-xl group-hover:scale-105 transition-all duration-300 ring-2 ring-transparent group-hover:ring-champagne group-hover:ring-offset-2">
                  <img
                    src={cat.img}
                    alt={cat.label}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <span className="text-sm sm:text-base font-semibold text-charcoal group-hover:text-champagne transition-colors text-center">
                  {cat.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── BESTSELLERS ── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-champagne text-xs tracking-[0.2em] uppercase font-medium">People keep coming back for these</p>
              <h2 className="font-display text-4xl font-semibold text-jet mt-1.5">Bestsellers</h2>
            </div>
            <Link to="/shop/women" className="text-sm text-champagne font-semibold hover:text-jet transition-colors hidden sm:flex items-center gap-1">
              See all <span>→</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {bestsellers.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* ── COLLECTION BANNERS — 3 cards ── */}
      <section className="bg-[#FAF9F7] py-16 sm:py-20">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-champagne text-xs tracking-[0.2em] uppercase font-medium">Curated for you</p>
            <h2 className="font-display text-4xl font-semibold text-jet mt-2">Featured Collections</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {collectionBanners.map((b) => (
              <Link
                key={b.label}
                to={b.to}
                className="group relative overflow-hidden rounded-3xl aspect-[3/4] sm:aspect-[4/5] block"
              >
                <img
                  src={b.img}
                  alt={b.label}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-7">
                  <p className="font-display text-white text-2xl sm:text-2xl font-semibold leading-tight">{b.label}</p>
                  <p className="text-white/65 text-sm mt-1.5 leading-snug">{b.desc}</p>
                  <span className="inline-flex items-center gap-1.5 mt-4 bg-white text-jet text-xs font-semibold px-4 py-2 rounded-full group-hover:bg-champagne group-hover:text-white transition-all duration-300">
                    {b.cta} →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEW ARRIVALS ── */}
      {newArrivals.length > 0 && (
        <section className="py-16 sm:py-20">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-champagne text-xs tracking-[0.2em] uppercase font-medium">Fresh in</p>
                <h2 className="font-display text-4xl font-semibold text-jet mt-1.5">New Arrivals</h2>
              </div>
              <Link to="/shop/new" className="text-sm text-champagne font-semibold hover:text-jet transition-colors hidden sm:flex items-center gap-1">
                See all <span>→</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {newArrivals.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── FULL-WIDTH OFFER BANNER ── */}
      <section className="relative overflow-hidden bg-jet mx-0">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1765229276796-c93c73cc3f3b?w=1800&h=600&fit=crop&auto=format"
            alt=""
            className="w-full h-full object-cover object-top opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-jet via-jet/90 to-jet/60" />
        </div>
        <div className="relative z-10 max-w-screen-xl mx-auto px-6 sm:px-10 py-20 sm:py-28 flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-1">
            <span className="text-champagne text-xs tracking-[0.2em] uppercase font-semibold">Limited time offer</span>
            <h3 className="font-display text-5xl sm:text-6xl text-white font-semibold mt-3 leading-[1.0]">
              Up to 40% off.<br />
              <em className="font-normal text-white/50 not-italic">Yes, really.</em>
            </h3>
            <p className="text-white/45 mt-4 text-sm leading-relaxed max-w-sm">
              Thoughtfully selected pieces at prices that make sense. No gimmicks, just a sale worth your time.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/offers" className="bg-champagne text-white px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-white hover:text-jet transition-all duration-300">
                Browse the sale
              </Link>
              <Link to="/shop/women" className="border border-white/25 text-white/80 px-7 py-3.5 rounded-full text-sm font-semibold hover:border-white hover:text-white transition-all duration-300">
                New arrivals
              </Link>
            </div>
          </div>
          <div className="hidden sm:flex flex-col gap-3">
            {["Free shipping", "30-day returns", "Genuine products"].map((t) => (
              <div key={t} className="flex items-center gap-3 bg-white/8 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-3">
                <span className="text-champagne text-lg">✓</span>
                <span className="text-white/80 text-sm font-medium">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section className="py-16 sm:py-20 bg-[#FAF9F7]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-champagne text-xs tracking-[0.2em] uppercase font-medium">Real reviews</p>
            <h2 className="font-display text-4xl font-semibold text-jet mt-2">What people are saying</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: "Priya M.", location: "Mumbai", review: "Got the silk dress and honestly? Best thing in my wardrobe right now. Wore it to three different events already.", rating: 5, item: "Silk Slip Midi Dress" },
              { name: "Rahul K.", location: "Bangalore", review: "The cashmere crewneck is unreal. My old jumpers feel like sandpaper in comparison. Worth every rupee.", rating: 5, item: "Cashmere Crewneck" },
              { name: "Aisha T.", location: "Delhi", review: "Shipping was fast, returns were zero fuss. The tote is exactly what I needed — proper leather, not plasticky.", rating: 4, item: "Structured Tote Bag" },
            ].map((r) => (
              <div key={r.name} className="bg-white rounded-2xl p-6 shadow-sm border border-ghost">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={`text-sm ${i < r.rating ? "text-champagne" : "text-silver"}`}>★</span>
                  ))}
                </div>
                <p className="text-sm text-charcoal leading-relaxed">"{r.review}"</p>
                <div className="mt-5 flex items-center justify-between border-t border-ghost pt-4">
                  <div>
                    <p className="text-xs font-semibold text-jet">{r.name}</p>
                    <p className="text-xs text-slate">{r.location}</p>
                  </div>
                  <p className="text-[10px] text-slate italic text-right max-w-[100px]">{r.item}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER ── */}
      <section className="py-16 sm:py-20 px-4 bg-white">
        <div className="max-w-screen-sm mx-auto text-center">
          <p className="font-display text-4xl sm:text-5xl text-jet font-semibold leading-snug">
            Good stuff,<br />
            <span className="italic font-normal text-champagne">straight to you.</span>
          </p>
          <p className="text-charcoal/55 mt-4 text-sm leading-relaxed">
            New drops, honest style notes, and the occasional exclusive deal. No spam, ever.
          </p>
          <form
            className="flex gap-0 mt-8 max-w-sm mx-auto rounded-full overflow-hidden border border-silver/40 bg-[#FAF9F7] shadow-md"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-5 py-3.5 text-sm text-jet outline-none bg-transparent"
            />
            <button
              type="submit"
              className="bg-champagne text-white px-5 py-3 text-xs font-semibold tracking-wide rounded-full shrink-0 hover:bg-jet transition-colors m-1"
            >
              Subscribe
            </button>
          </form>
          <p className="text-xs text-slate mt-3">Join 24,000+ people who already get it.</p>
        </div>
      </section>

    </div>
  );
}
