import { useState, useMemo } from "react";
import { useParams, Link } from "react-router";
import ProductCard from "../components/ProductCard";
import { products, categories, brands, formatPrice } from "../data/products";

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest First" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "rating", label: "Top Rated" },
  { value: "discount", label: "Best Discount" },
];

export default function ProductListing() {
  const { category = "women", subcategory } = useParams();
  const [sort, setSort] = useState("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(25000);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [onlyDiscount, setOnlyDiscount] = useState(false);

  const catInfo = categories.find((c) => c.id === category);

  const filtered = useMemo(() => {
    let list = products.filter((p) =>
      category === "new" ? p.isNew : p.category === category && (!subcategory || p.subcategory === subcategory)
    );
    if (selectedBrands.length) list = list.filter((p) => selectedBrands.includes(p.brand));
    list = list.filter((p) => p.price <= maxPrice);
    if (selectedColors.length) list = list.filter((p) => p.colors.some((c) => selectedColors.includes(c.name)));
    if (onlyDiscount) list = list.filter((p) => !!p.discount);
    switch (sort) {
      case "price-asc": return [...list].sort((a, b) => a.price - b.price);
      case "price-desc": return [...list].sort((a, b) => b.price - a.price);
      case "rating": return [...list].sort((a, b) => b.rating - a.rating);
      case "discount": return [...list].sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
      case "newest": return [...list].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
      default: return list;
    }
  }, [category, subcategory, sort, selectedBrands, maxPrice, selectedColors, onlyDiscount]);

  function toggleBrand(b: string) {
    setSelectedBrands((p) => p.includes(b) ? p.filter((x) => x !== b) : [...p, b]);
  }
  function toggleColor(c: string) {
    setSelectedColors((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c]);
  }

  const activeFilterCount = selectedBrands.length + selectedColors.length + (onlyDiscount ? 1 : 0) + (maxPrice < 25000 ? 1 : 0);
  const colorOptions = Array.from(new Set(products.flatMap((p) => p.colors.map((c) => c.name)))).slice(0, 10);

  const title = category === "new"
    ? "New Arrivals"
    : subcategory ? catInfo?.subcategories.find((s) => s.id === subcategory)?.label ?? subcategory
    : catInfo?.label ?? category;

  function clearAll() {
    setSelectedBrands([]); setSelectedColors([]); setOnlyDiscount(false); setMaxPrice(25000);
  }

  const Filters = () => (
    <div className="flex flex-col gap-7 text-sm">
      {/* Category links */}
      {catInfo && (
        <div>
          <p className="text-xs font-semibold text-jet uppercase tracking-widest mb-3">Category</p>
          <div className="flex flex-col gap-1.5">
            <Link
              to={`/shop/${category}`}
              className={`py-1 transition-colors ${!subcategory ? "text-champagne font-medium" : "text-charcoal hover:text-champagne"}`}
            >All {catInfo.label}</Link>
            {catInfo.subcategories.map((sub) => (
              <Link
                key={sub.id}
                to={`/shop/${category}/${sub.id}`}
                className={`py-1 transition-colors ${subcategory === sub.id ? "text-champagne font-medium" : "text-charcoal hover:text-champagne"}`}
              >{sub.label}</Link>
            ))}
          </div>
        </div>
      )}

      {/* Brand */}
      <div>
        <p className="text-xs font-semibold text-jet uppercase tracking-widest mb-3">Brand</p>
        <div className="flex flex-col gap-2">
          {brands.map((b) => (
            <label key={b} className="flex items-center gap-2.5 cursor-pointer group">
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${selectedBrands.includes(b) ? "bg-jet border-jet" : "border-silver group-hover:border-charcoal"}`}
                onClick={() => toggleBrand(b)}
              >
                {selectedBrands.includes(b) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className="text-charcoal group-hover:text-jet transition-colors" onClick={() => toggleBrand(b)}>{b}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-jet uppercase tracking-widest">Max Price</p>
          <span className="text-xs text-champagne font-semibold">{formatPrice(maxPrice)}</span>
        </div>
        <input
          type="range" min={1000} max={25000} step={500} value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full accent-champagne"
        />
        <div className="flex justify-between text-xs text-slate mt-1">
          <span>₹1,000</span><span>₹25,000+</span>
        </div>
      </div>

      {/* Colour */}
      <div>
        <p className="text-xs font-semibold text-jet uppercase tracking-widest mb-3">Colour</p>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map((col) => {
            const hex = products.find((p) => p.colors.find((c) => c.name === col))?.colors.find((c) => c.name === col)?.hex;
            const sel = selectedColors.includes(col);
            return (
              <button
                key={col}
                title={col}
                onClick={() => toggleColor(col)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${sel ? "border-jet scale-110 shadow" : "border-ghost hover:border-silver"}`}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      </div>

      {/* Offers only */}
      <label className="flex items-center gap-2.5 cursor-pointer">
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${onlyDiscount ? "bg-jet border-jet" : "border-silver"}`}
          onClick={() => setOnlyDiscount((v) => !v)}
        >
          {onlyDiscount && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <span className="text-charcoal" onClick={() => setOnlyDiscount((v) => !v)}>On sale only</span>
      </label>

      {activeFilterCount > 0 && (
        <button onClick={clearAll} className="text-xs text-rose hover:text-jet transition-colors border-t border-ghost pt-5 text-left font-medium">
          Clear all filters ({activeFilterCount})
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      {/* Hero band */}
      <div className="bg-[#FAF9F7] border-b border-ghost px-4 sm:px-6 py-8">
        <div className="max-w-screen-xl mx-auto">
          <nav className="flex gap-2 text-xs text-slate mb-3 flex-wrap">
            <Link to="/" className="hover:text-jet transition-colors">Home</Link>
            <span>/</span>
            <Link to={`/shop/${category}`} className="hover:text-jet transition-colors capitalize">{catInfo?.label ?? category}</Link>
            {subcategory && <><span>/</span><span className="text-jet capitalize">{catInfo?.subcategories.find((s) => s.id === subcategory)?.label}</span></>}
          </nav>
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-jet">{title}</h1>
              <p className="text-slate text-sm mt-1">{filtered.length} styles found</p>
            </div>
            {/* Subcategory pills */}
            {catInfo && !subcategory && (
              <div className="flex gap-2 flex-wrap">
                {catInfo.subcategories.slice(0, 5).map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/shop/${category}/${sub.id}`}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-ghost rounded-full text-charcoal hover:border-champagne hover:text-champagne transition-colors"
                  >{sub.label}</Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 mb-7">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mobile filter button */}
            <button
              onClick={() => setFiltersOpen(true)}
              className="lg:hidden flex items-center gap-2 border border-ghost rounded-full px-4 py-2 text-sm font-medium text-charcoal hover:border-jet transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" />
              </svg>
              Filters {activeFilterCount > 0 && <span className="bg-champagne text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
            </button>

            {/* Active filter chips */}
            {selectedBrands.map((b) => (
              <button key={b} onClick={() => toggleBrand(b)} className="hidden sm:flex items-center gap-1.5 bg-sand px-3 py-1.5 rounded-full text-xs font-medium text-charcoal hover:bg-ghost transition-colors">
                {b} <span className="text-slate">×</span>
              </button>
            ))}
            {onlyDiscount && (
              <button onClick={() => setOnlyDiscount(false)} className="hidden sm:flex items-center gap-1.5 bg-sand px-3 py-1.5 rounded-full text-xs font-medium text-charcoal hover:bg-ghost transition-colors">
                On sale <span className="text-slate">×</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate hidden sm:inline">Sort by</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="border border-ghost rounded-full px-4 py-2 text-xs font-medium text-charcoal bg-white outline-none cursor-pointer hover:border-jet transition-colors appearance-none pr-8"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23717171' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
            >
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-52 shrink-0">
            <Filters />
          </aside>

          {/* Grid */}
          <div className="flex-1 min-w-0">
            {filtered.length === 0 ? (
              <div className="py-24 text-center">
                <p className="font-display text-2xl text-jet">Nothing matched your filters.</p>
                <p className="text-slate text-sm mt-2">Try loosening them up a bit.</p>
                <button onClick={clearAll} className="mt-6 bg-jet text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors">
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} />
          <div className="relative ml-auto bg-white w-80 max-w-full h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ghost">
              <p className="font-semibold text-jet">Filters {activeFilterCount > 0 && <span className="ml-1 text-champagne text-sm">({activeFilterCount})</span>}</p>
              <button onClick={() => setFiltersOpen(false)} className="w-8 h-8 rounded-full bg-sand flex items-center justify-center">
                <svg className="w-4 h-4 text-charcoal" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <Filters />
            </div>
            <div className="p-5 border-t border-ghost bg-white">
              <button
                onClick={() => setFiltersOpen(false)}
                className="w-full bg-jet text-white py-3.5 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors"
              >
                Show {filtered.length} results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
