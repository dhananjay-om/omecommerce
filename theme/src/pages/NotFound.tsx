import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="font-display text-[10rem] font-semibold text-ghost leading-none select-none">404</p>
      <div className="-mt-8">
        <p className="font-display text-3xl font-medium text-jet">Page not found</p>
        <p className="text-slate mt-2 max-w-sm text-sm">The page you're looking for has been moved or no longer exists.</p>
      </div>
      <div className="flex gap-3 mt-4">
        <Link to="/" className="bg-jet text-white px-6 py-3 text-xs tracking-widest uppercase font-semibold hover:bg-charcoal transition-colors">
          Back to Home
        </Link>
        <Link to="/shop/women" className="border border-jet px-6 py-3 text-xs tracking-widest uppercase font-semibold text-jet hover:bg-jet hover:text-white transition-colors">
          Shop Now
        </Link>
      </div>
    </div>
  );
}
