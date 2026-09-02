import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router";
import ProductCard from "../components/ProductCard";
import { searchProducts, products } from "../data/products";

const trending = ["Silk Dress", "Cashmere", "Tote Bag", "Chelsea Boots", "Linen Top", "Blazer"];

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [input, setInput] = useState(query);
  const results = query ? searchProducts(query) : [];

  useEffect(() => { setInput(query); }, [query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) setSearchParams({ q: input.trim() });
  }

  const suggestions = query.length > 0
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3)
    : [];

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10">
      {/* Search input */}
      <div className="max-w-2xl mx-auto mb-10">
        <form onSubmit={handleSubmit} className="flex gap-0 border-b-2 border-jet pb-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search styles, brands, categories..."
            className="flex-1 text-xl sm:text-2xl font-display font-medium text-jet placeholder-silver outline-none bg-transparent pr-4"
            autoFocus
          />
          {input && (
            <button
              type="button"
              onClick={() => { setInput(""); setSearchParams({}); }}
              className="text-silver hover:text-rose transition-colors mr-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <button type="submit" className="text-charcoal hover:text-jet transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        </form>

        {/* Trending */}
        {!query && (
          <div className="mt-6">
            <p className="text-xs tracking-widest uppercase text-slate mb-3">Trending Searches</p>
            <div className="flex flex-wrap gap-2">
              {trending.map((t) => (
                <button
                  key={t}
                  onClick={() => { setInput(t); setSearchParams({ q: t }); }}
                  className="border border-ghost px-3 py-1.5 text-sm text-charcoal hover:border-jet hover:text-jet transition-colors rounded-full"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {query && (
        <>
          {results.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-display text-3xl text-jet">No results for "{query}"</p>
              <p className="text-slate mt-2 text-sm">Try a different search term or browse our categories.</p>
              <div className="flex justify-center gap-3 mt-8">
                {["Women", "Men", "Accessories", "Sale"].map((cat) => (
                  <Link
                    key={cat}
                    to={cat === "Sale" ? "/offers" : `/shop/${cat.toLowerCase()}`}
                    className="border border-ghost px-4 py-2 text-xs tracking-widest uppercase text-charcoal hover:border-jet transition-colors"
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="text-xs tracking-widest text-slate uppercase">Search results for</p>
                  <h1 className="font-display text-2xl font-medium text-jet mt-0.5">"{query}"</h1>
                </div>
                <p className="text-sm text-slate">{results.length} results</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {results.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Browse categories */}
      {!query && (
        <div className="mt-8">
          <p className="text-xs tracking-widest uppercase text-slate mb-6 text-center">Or browse by category</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Women", to: "/shop/women", img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=500&fit=crop&auto=format" },
              { label: "Men", to: "/shop/men", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&auto=format" },
              { label: "Accessories", to: "/shop/accessories", img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=500&fit=crop&auto=format" },
              { label: "Sale", to: "/offers", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=500&fit=crop&auto=format" },
            ].map((cat) => (
              <Link
                key={cat.label}
                to={cat.to}
                className="group relative overflow-hidden rounded-sm aspect-[3/4] bg-sand"
              >
                <img src={cat.img} alt={cat.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <p className="absolute bottom-4 left-4 font-display text-xl text-white font-medium">{cat.label}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
