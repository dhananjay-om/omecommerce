import { Link } from "react-router";

const footerLinks = {
  Shop: [
    { label: "New Arrivals", to: "/shop/new" },
    { label: "Women", to: "/shop/women" },
    { label: "Men", to: "/shop/men" },
    { label: "Accessories", to: "/shop/accessories" },
    { label: "Sale & Offers", to: "/offers" },
  ],
  Help: [
    { label: "Size Guide", to: "/account" },
    { label: "Shipping & Returns", to: "/account" },
    { label: "Track My Order", to: "/account" },
    { label: "FAQs", to: "/account" },
    { label: "Contact Us", to: "/account" },
  ],
  Company: [
    { label: "About Élume", to: "/" },
    { label: "Sustainability", to: "/" },
    { label: "Careers", to: "/" },
    { label: "Press", to: "/" },
    { label: "Affiliates", to: "/" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-jet text-white mt-auto">
      {/* Trust strip */}
      <div className="border-b border-white/10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: "🚚", title: "Free Shipping", sub: "On orders above ₹3,000" },
            { icon: "↩", title: "Easy Returns", sub: "30-day hassle-free returns" },
            { icon: "🔒", title: "Secure Payments", sub: "256-bit SSL encryption" },
            { icon: "✦", title: "Authentic Products", sub: "100% genuine brands" },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 items-start">
              <span className="text-champagne text-xl leading-none mt-0.5">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold tracking-wide">{item.title}</p>
                <p className="text-xs text-white/50 mt-0.5">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Newsletter */}
      <div className="border-b border-white/10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-display text-xl italic text-white/90">Stay in the edit.</p>
            <p className="text-sm text-white/50 mt-1">Subscribe for new arrivals, exclusive access & style notes.</p>
          </div>
          <form className="flex gap-0 w-full max-w-sm" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-champagne transition-colors"
            />
            <button
              type="submit"
              className="bg-champagne text-white px-5 py-2.5 text-xs tracking-widest uppercase font-semibold hover:bg-champagne/90 transition-colors shrink-0"
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>

      {/* Links */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <p className="font-display text-2xl font-semibold tracking-[0.1em] mb-4">ÉLUME</p>
          <p className="text-xs text-white/40 leading-relaxed">
            Curating the finest in contemporary fashion. Discover timeless pieces and emerging designers from around the world.
          </p>
          <div className="flex gap-3 mt-5">
            {["instagram", "pinterest", "twitter"].map((sn) => (
              <a
                key={sn}
                href="#"
                className="w-8 h-8 border border-white/20 rounded-full flex items-center justify-center text-white/50 hover:border-champagne hover:text-champagne transition-colors text-xs"
              >
                {sn[0].toUpperCase()}
              </a>
            ))}
          </div>
        </div>

        {Object.entries(footerLinks).map(([heading, links]) => (
          <div key={heading}>
            <p className="text-xs tracking-widest uppercase font-semibold text-white/70 mb-4">{heading}</p>
            <ul className="flex flex-col gap-2">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/40 hover:text-champagne transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/30">© 2025 Élume. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">Privacy Policy</Link>
            <Link to="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">Terms of Service</Link>
            <Link to="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
