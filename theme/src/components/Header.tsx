import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { useShop } from "../context/ShopContext";
import { categories } from "../data/products";

const NAV = [
  { label: "New Arrivals", path: "/shop/new" },
  { label: "Women", path: "/shop/women", cat: "women" },
  { label: "Men", path: "/shop/men", cat: "men" },
  { label: "Accessories", path: "/shop/accessories", cat: "accessories" },
  { label: "Offers", path: "/offers" },
];

export default function Header() {
  const { cartCount, wishlistCount, setCartOpen } = useShop();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mega, setMega] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const megaTimer = useRef<number | null>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  function openMega(cat: string) {
    if (megaTimer.current) window.clearTimeout(megaTimer.current);
    setMega(cat);
  }

  function closeMega() {
    megaTimer.current = window.setTimeout(() => setMega(null), 130);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      window.location.hash = `/search?q=${encodeURIComponent(q)}`;
      setSearchOpen(false);
      setQuery("");
    }
  }

  const catInfo = (id: string) => categories.find((c) => c.id === id);

  return (
    <>
      {/* Announcement bar */}
      <div className="bg-jet text-white text-center text-xs py-2 tracking-wider font-sans select-none">
        Free shipping over ₹3,000 &nbsp;·&nbsp; Code{" "}
        <span className="text-champagne font-semibold">ELUME15</span> for 15% off
      </div>

      <header className={`sticky top-0 z-50 bg-white border-b border-ghost transition-shadow duration-300 ${scrolled ? "shadow-sm" : ""}`}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 flex items-center h-16 gap-4">

          {/* Hamburger */}
          <button
            className="lg:hidden flex flex-col gap-[5px] w-5 shrink-0 py-1"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            <span className={`block h-[1.5px] bg-jet rounded transition-all duration-200 ${mobileOpen ? "rotate-45 translate-y-[6.5px]" : ""}`} />
            <span className={`block h-[1.5px] bg-jet rounded transition-all duration-200 ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block h-[1.5px] bg-jet rounded transition-all duration-200 ${mobileOpen ? "-rotate-45 -translate-y-[6.5px]" : ""}`} />
          </button>

          {/* Logo */}
          <Link to="/" className="flex-1 lg:flex-none text-center lg:text-left">
            <span className="font-display text-2xl font-semibold tracking-[0.12em] text-jet">ÉLUME</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {NAV.map((link) => (
              <div
                key={link.label}
                className="relative"
                onMouseEnter={() => link.cat && openMega(link.cat)}
                onMouseLeave={closeMega}
              >
                <Link
                  to={link.path}
                  className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                    location.pathname.startsWith(link.path) && link.path !== "/"
                      ? "bg-champagne/10 text-champagne"
                      : "text-charcoal hover:text-jet hover:bg-sand"
                  }`}
                >
                  {link.label}
                </Link>

                {link.cat && mega === link.cat && (
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50"
                    onMouseEnter={() => openMega(link.cat!)}
                    onMouseLeave={closeMega}
                  >
                    <div className="bg-white border border-ghost shadow-xl rounded-2xl w-[480px] p-7 grid grid-cols-3 gap-6">
                      {catInfo(link.cat)?.subcategories.map((sub) => (
                        <Link
                          key={sub.id}
                          to={`/shop/${link.cat}/${sub.id}`}
                          className="text-sm text-charcoal hover:text-champagne transition-colors"
                        >
                          {sub.label}
                        </Link>
                      ))}
                      <div className="col-span-3 border-t border-ghost pt-4">
                        <Link
                          to={`/shop/${link.cat}`}
                          className="text-xs tracking-widest uppercase font-semibold text-jet hover:text-champagne transition-colors"
                        >
                          Shop All {link.label} →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Icons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="p-2 rounded-full text-charcoal hover:text-jet hover:bg-sand transition-colors"
              aria-label="Search"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </button>

            <Link
              to="/account"
              className="p-2 rounded-full text-charcoal hover:text-jet hover:bg-sand transition-colors hidden sm:flex"
              aria-label="Account"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </Link>

            <Link
              to="/wishlist"
              className="p-2 rounded-full text-charcoal hover:text-jet hover:bg-sand transition-colors relative"
              aria-label="Wishlist"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-rose text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setCartOpen(true)}
              className="p-2 rounded-full text-charcoal hover:text-jet hover:bg-sand transition-colors relative"
              aria-label="Open cart"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-champagne text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="border-t border-ghost bg-white px-4 py-3">
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex items-center gap-3">
              <svg className="w-4 h-4 text-slate shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for styles, brands, or categories..."
                className="flex-1 text-sm outline-none text-jet placeholder:text-silver bg-transparent"
              />
              {query && (
                <button type="submit" className="text-xs font-semibold text-champagne hover:text-jet transition-colors shrink-0">
                  Search
                </button>
              )}
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setQuery(""); }}
                className="text-silver hover:text-jet transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative bg-white w-72 h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ghost">
              <span className="font-display text-xl font-semibold tracking-[0.1em]">ÉLUME</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-full bg-sand flex items-center justify-center"
              >
                <svg className="w-4 h-4 text-charcoal" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-5 flex flex-col gap-0.5">
              {NAV.map((link) => (
                <div key={link.label}>
                  <Link
                    to={link.path}
                    className="flex items-center justify-between py-3 text-sm font-semibold text-charcoal hover:text-champagne transition-colors border-b border-ghost"
                  >
                    {link.label}
                  </Link>
                  {link.cat && (
                    <div className="pl-3 py-2 flex flex-col gap-0.5">
                      {catInfo(link.cat)?.subcategories.map((sub) => (
                        <Link
                          key={sub.id}
                          to={`/shop/${link.cat}/${sub.id}`}
                          className="py-1.5 text-xs text-slate hover:text-champagne transition-colors"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <Link
                to="/account"
                className="py-3 text-sm font-semibold text-charcoal hover:text-champagne transition-colors border-b border-ghost"
              >
                My Account
              </Link>
              <Link
                to="/wishlist"
                className="py-3 text-sm font-semibold text-charcoal hover:text-champagne transition-colors border-b border-ghost"
              >
                Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
