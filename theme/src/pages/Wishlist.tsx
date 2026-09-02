import { Link } from "react-router";
import { useShop } from "../context/ShopContext";
import { formatPrice } from "../data/products";

export default function Wishlist() {
  const { wishlist, toggleWishlist, addToCart } = useShop();

  if (wishlist.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 px-4">
        <div className="w-20 h-20 bg-blush rounded-full flex items-center justify-center">
          <svg className="w-9 h-9 text-rose/50" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <p className="font-display text-2xl text-jet">Your wishlist is empty</p>
        <p className="text-sm text-slate text-center max-w-xs">Save the pieces you love and come back to them anytime.</p>
        <Link
          to="/shop/women"
          className="mt-2 bg-jet text-white px-8 py-3 text-xs tracking-widest uppercase font-semibold hover:bg-charcoal transition-colors"
        >
          Discover Styles
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-medium text-jet">My Wishlist</h1>
          <p className="text-sm text-slate mt-1">{wishlist.length} {wishlist.length === 1 ? "item" : "items"} saved</p>
        </div>
        <button
          onClick={() => wishlist.forEach((p) => toggleWishlist(p))}
          className="text-xs text-slate hover:text-rose transition-colors tracking-wide"
        >
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {wishlist.map((product) => (
          <div key={product.id} className="group relative">
            <div className="relative overflow-hidden bg-sand aspect-[3/4] rounded-sm">
              <Link to={`/product/${product.id}`} className="block w-full h-full">
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </Link>

              {/* Remove */}
              <button
                onClick={() => toggleWishlist(product)}
                className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-rose hover:text-white text-rose"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" stroke="currentColor" strokeWidth={0} viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" strokeWidth={2} stroke="currentColor" fill="none" /><line x1="6" y1="6" x2="18" y2="18" strokeWidth={2} stroke="currentColor" fill="none" />
                </svg>
              </button>

              {/* Move to bag */}
              <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                <button
                  onClick={() => addToCart(product, product.sizes[0], product.colors[0].name)}
                  className="w-full bg-jet/90 text-white text-xs tracking-widest uppercase py-3 font-medium hover:bg-jet transition-colors"
                >
                  Move to Bag
                </button>
              </div>
            </div>

            <div className="mt-3 px-0.5">
              <p className="text-[10px] tracking-widest text-slate uppercase">{product.brand}</p>
              <Link to={`/product/${product.id}`}>
                <h3 className="text-sm font-medium text-jet mt-0.5 hover:text-champagne transition-colors">{product.name}</h3>
              </Link>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm font-semibold text-jet">{formatPrice(product.price)}</span>
                {product.originalPrice && (
                  <span className="text-xs text-slate line-through">{formatPrice(product.originalPrice)}</span>
                )}
                {product.discount && (
                  <span className="text-xs text-rose font-medium">{product.discount}% off</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Share wishlist */}
      <div className="mt-12 bg-ivory rounded-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-jet">Share Your Wishlist</p>
          <p className="text-sm text-slate mt-1">Let someone special know what you love.</p>
        </div>
        <div className="flex gap-2">
          <button className="border border-ghost px-4 py-2 text-xs tracking-widest uppercase text-charcoal hover:border-jet transition-colors">
            Copy Link
          </button>
          <button className="border border-ghost px-4 py-2 text-xs tracking-widest uppercase text-charcoal hover:border-jet transition-colors">
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
