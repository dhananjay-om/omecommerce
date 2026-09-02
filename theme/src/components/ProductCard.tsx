import { Link } from "react-router";
import { useShop } from "../context/ShopContext";
import type { Product } from "../data/products";
import { formatPrice } from "../data/products";

interface Props {
  product: Product;
  layout?: "grid" | "list";
}

export default function ProductCard({ product, layout = "grid" }: Props) {
  const { toggleWishlist, isWishlisted, addToCart } = useShop();
  const wishlisted = isWishlisted(product.id);

  if (layout === "list") {
    return (
      <div className="flex gap-5 border-b border-ghost pb-6">
        <Link to={`/product/${product.id}`} className="shrink-0 w-32 h-40 bg-sand overflow-hidden rounded-sm product-img-wrap">
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
        </Link>
        <div className="flex-1 py-1">
          <p className="text-xs tracking-widest text-slate uppercase">{product.brand}</p>
          <Link to={`/product/${product.id}`}>
            <h3 className="font-display text-base font-medium text-jet mt-0.5 hover:text-champagne transition-colors">{product.name}</h3>
          </Link>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={`text-xs ${i < Math.round(product.rating) ? "text-champagne" : "text-silver"}`}>★</span>
              ))}
            </div>
            <span className="text-xs text-slate">({product.reviews})</span>
          </div>
          <p className="text-sm text-slate mt-2 line-clamp-2">{product.description}</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="font-semibold text-jet">{formatPrice(product.price)}</span>
            {product.originalPrice && (
              <>
                <span className="text-sm text-slate line-through">{formatPrice(product.originalPrice)}</span>
                <span className="text-xs bg-rose/10 text-rose px-1.5 py-0.5 rounded font-medium">{product.discount}% OFF</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => toggleWishlist(product)}
          className="shrink-0 self-start mt-1 p-1.5 text-charcoal hover:text-rose transition-colors"
        >
          <svg className="w-5 h-5" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" className={wishlisted ? "text-rose" : ""} />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="group relative">
      {/* Image */}
      <div className="relative overflow-hidden bg-sand aspect-[3/4] rounded-2xl product-img-wrap">
        <Link to={`/product/${product.id}`} className="block w-full h-full">
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.isNew && (
            <span className="bg-jet text-white text-[10px] tracking-widest px-2 py-0.5 font-medium uppercase">New</span>
          )}
          {product.isBestseller && (
            <span className="bg-champagne text-white text-[10px] tracking-widest px-2 py-0.5 font-medium uppercase">Bestseller</span>
          )}
          {product.discount && (
            <span className="bg-rose text-white text-[10px] tracking-widest px-2 py-0.5 font-medium uppercase">{product.discount}% Off</span>
          )}
        </div>

        {/* Wishlist */}
        <button
          onClick={() => toggleWishlist(product)}
          className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white"
          aria-label="Add to wishlist"
        >
          <svg className="w-4 h-4" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" className={wishlisted ? "text-rose" : "text-charcoal"} />
          </svg>
        </button>

        {/* Quick add */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
          <button
            onClick={() => addToCart(product, product.sizes[0], product.colors[0].name)}
            className="w-full bg-jet/90 backdrop-blur-sm text-white text-xs font-semibold py-3 hover:bg-jet transition-colors rounded-b-2xl"
          >
            Quick Add
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-3 px-0.5">
        <p className="text-[10px] tracking-widest text-slate uppercase">{product.brand}</p>
        <Link to={`/product/${product.id}`}>
          <h3 className="text-sm font-medium text-jet mt-0.5 hover:text-champagne transition-colors leading-snug">{product.name}</h3>
        </Link>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-jet">{formatPrice(product.price)}</span>
            {product.originalPrice && (
              <span className="text-xs text-slate line-through">{formatPrice(product.originalPrice)}</span>
            )}
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={`text-[10px] ${i < Math.round(product.rating) ? "text-champagne" : "text-silver"}`}>★</span>
            ))}
          </div>
        </div>
        {/* Color dots */}
        <div className="flex gap-1.5 mt-2">
          {product.colors.slice(0, 4).map((c) => (
            <div
              key={c.name}
              title={c.name}
              className="w-3 h-3 rounded-full border border-ghost cursor-pointer hover:scale-110 transition-transform"
              style={{ backgroundColor: c.hex }}
            />
          ))}
          {product.colors.length > 4 && (
            <span className="text-[10px] text-slate self-center">+{product.colors.length - 4}</span>
          )}
        </div>
      </div>
    </div>
  );
}
