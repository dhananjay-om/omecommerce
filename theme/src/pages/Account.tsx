import { useState } from "react";
import { Link } from "react-router";

type Tab = "overview" | "orders" | "addresses" | "settings";

const mockOrders = [
  { id: "ELM847291", date: "12 Aug 2025", status: "Delivered", total: 16290, items: ["Silk Slip Midi Dress", "Linen Off-Shoulder Top"], img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=120&h=140&fit=crop&auto=format" },
  { id: "ELM724530", date: "28 Jul 2025", status: "In Transit", total: 9800, items: ["Structured Tote Bag"], img: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=120&h=140&fit=crop&auto=format" },
  { id: "ELM619482", date: "14 Jul 2025", status: "Delivered", total: 25700, items: ["Cashmere Crewneck", "Slim Tapered Chinos"], img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=120&h=140&fit=crop&auto=format" },
];

const statusStyle: Record<string, string> = {
  Delivered: "bg-green-50 text-green-700",
  "In Transit": "bg-blue-50 text-blue-600",
  Processing: "bg-sand text-charcoal",
  Cancelled: "bg-rose/10 text-rose",
};

export default function Account() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  if (!loggedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 bg-white">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#FAF9F7] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-silver" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <p className="font-display text-3xl font-semibold text-jet">Welcome back</p>
            <p className="text-slate text-sm mt-1.5">Sign in to your Élume account</p>
          </div>

          <div className="bg-[#FAF9F7] rounded-2xl p-6 flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-slate block mb-1.5">Email Address</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="w-full border border-ghost rounded-xl px-4 py-3 text-sm text-jet outline-none focus:border-champagne transition-colors bg-white"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-medium text-slate">Password</label>
                <button className="text-xs text-champagne hover:text-jet transition-colors">Forgot?</button>
              </div>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full border border-ghost rounded-xl px-4 py-3 text-sm text-jet outline-none focus:border-champagne transition-colors bg-white"
              />
            </div>
            <button
              onClick={() => setLoggedIn(true)}
              className="mt-1 bg-jet text-white py-3.5 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors"
            >
              Sign In
            </button>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-ghost" />
              <span className="text-xs text-slate">or</span>
              <div className="flex-1 h-px bg-ghost" />
            </div>
            <button className="border border-ghost bg-white rounded-full py-3 text-xs font-semibold text-charcoal hover:border-jet transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
          </div>

          <p className="text-center text-xs text-slate mt-5">
            New to Élume?{" "}
            <button onClick={() => setLoggedIn(true)} className="text-champagne hover:text-jet font-semibold transition-colors">
              Create an account →
            </button>
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "overview", label: "Overview", emoji: "🏠" },
    { id: "orders", label: "Orders", emoji: "📦" },
    { id: "addresses", label: "Addresses", emoji: "📍" },
    { id: "settings", label: "Settings", emoji: "⚙️" },
  ];

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex gap-8">

          {/* Sidebar */}
          <aside className="hidden lg:flex flex-col gap-3 w-60 shrink-0">
            {/* Profile card */}
            <div className="bg-[#FAF9F7] rounded-2xl p-5 text-center border border-ghost mb-2">
              <div className="w-16 h-16 bg-champagne/20 rounded-full mx-auto flex items-center justify-center">
                <span className="font-display text-2xl text-champagne font-semibold">S</span>
              </div>
              <p className="font-semibold text-jet mt-3">Sophia Laurent</p>
              <p className="text-xs text-slate mt-0.5">sophia@example.com</p>
              <span className="inline-block mt-2 bg-champagne/10 text-champagne text-[10px] font-semibold px-3 py-1 rounded-full">
                ✦ Elite Member
              </span>
            </div>

            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                  tab === t.id ? "bg-jet text-white" : "text-charcoal hover:bg-[#FAF9F7]"
                }`}
              >
                <span className="text-base">{t.emoji}</span>
                {t.label}
              </button>
            ))}

            <button
              onClick={() => setLoggedIn(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate hover:text-rose transition-colors text-left mt-2"
            >
              <span>→</span> Sign Out
            </button>
          </aside>

          {/* Mobile tab strip */}
          <div className="lg:hidden w-full">
            <div className="flex gap-1 overflow-x-auto pb-1 mb-6 border-b border-ghost">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 shrink-0 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    tab === t.id ? "border-jet text-jet" : "border-transparent text-slate hover:text-jet"
                  }`}
                >
                  <span>{t.emoji}</span>{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 lg:block">

            {/* OVERVIEW */}
            {tab === "overview" && (
              <div>
                <h1 className="font-display text-2xl font-semibold text-jet mb-6">Good to see you, Sophia 👋</h1>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[
                    { label: "Orders", value: "12", color: "text-jet" },
                    { label: "Wishlist", value: "0", color: "text-rose" },
                    { label: "Points", value: "2,450", color: "text-champagne" },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#FAF9F7] rounded-2xl p-4 sm:p-5 text-center border border-ghost">
                      <p className={`font-display text-3xl font-semibold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-slate mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Recent orders */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-jet">Recent Orders</h2>
                    <button onClick={() => setTab("orders")} className="text-xs text-champagne hover:text-jet transition-colors font-medium">View all →</button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {mockOrders.slice(0, 2).map((order) => (
                      <div key={order.id} className="flex gap-4 border border-ghost rounded-2xl p-4 hover:border-champagne/40 transition-colors">
                        <div className="w-14 h-16 rounded-xl overflow-hidden bg-sand shrink-0">
                          <img src={order.img} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-slate">Order #{order.id}</p>
                              <p className="text-sm font-medium text-jet mt-0.5 leading-snug line-clamp-1">{order.items.join(", ")}</p>
                              <p className="text-xs text-slate mt-1">{order.date}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${statusStyle[order.status]}`}>{order.status}</span>
                              <p className="text-sm font-bold text-jet mt-1">₹{order.total.toLocaleString("en-IN")}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ORDERS */}
            {tab === "orders" && (
              <div>
                <h1 className="font-display text-2xl font-semibold text-jet mb-6">Your Orders</h1>
                <div className="flex flex-col gap-4">
                  {mockOrders.map((order) => (
                    <div key={order.id} className="border border-ghost rounded-2xl overflow-hidden">
                      <div className="bg-[#FAF9F7] px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-ghost">
                        <div className="flex gap-4 sm:gap-6 flex-wrap">
                          <div>
                            <p className="text-[10px] text-slate uppercase tracking-widest">Placed</p>
                            <p className="text-xs font-semibold text-jet mt-0.5">{order.date}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate uppercase tracking-widest">Total</p>
                            <p className="text-xs font-semibold text-jet mt-0.5">₹{order.total.toLocaleString("en-IN")}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate uppercase tracking-widest">Order ID</p>
                            <p className="text-xs font-semibold text-jet mt-0.5">#{order.id}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle[order.status]}`}>{order.status}</span>
                      </div>
                      <div className="p-5 flex gap-4 items-center">
                        <div className="w-14 h-16 rounded-xl overflow-hidden bg-sand shrink-0">
                          <img src={order.img} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-jet line-clamp-1">{order.items.join(", ")}</p>
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {["Track", "Invoice", "Return", "Reorder"].map((a) => (
                              <button key={a} className="border border-ghost rounded-lg px-3 py-1.5 text-xs font-medium text-charcoal hover:border-jet hover:text-jet transition-colors">
                                {a}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ADDRESSES */}
            {tab === "addresses" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="font-display text-2xl font-semibold text-jet">Saved Addresses</h1>
                  <button className="flex items-center gap-2 bg-jet text-white px-4 py-2.5 rounded-full text-xs font-semibold hover:bg-charcoal transition-colors">
                    + Add New
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Home", address: "42, Primrose Lane, Bandra West, Mumbai — 400050", phone: "+91 98765 43210", default: true },
                    { label: "Office", address: "Prestige Tower, 7th Floor, MG Road, Bengaluru — 560001", phone: "+91 98765 43210", default: false },
                  ].map((addr) => (
                    <div key={addr.label} className={`border-2 rounded-2xl p-5 relative ${addr.default ? "border-champagne" : "border-ghost"}`}>
                      {addr.default && (
                        <span className="absolute top-4 right-4 bg-champagne/10 text-champagne text-[10px] font-semibold px-2.5 py-1 rounded-full">Default</span>
                      )}
                      <div className="w-8 h-8 bg-[#FAF9F7] rounded-full flex items-center justify-center mb-3">
                        <span className="text-sm">{addr.label === "Home" ? "🏠" : "🏢"}</span>
                      </div>
                      <p className="text-xs font-semibold text-jet uppercase tracking-widest mb-1">{addr.label}</p>
                      <p className="text-sm text-charcoal leading-relaxed">{addr.address}</p>
                      <p className="text-xs text-slate mt-1">{addr.phone}</p>
                      <div className="flex gap-3 mt-4 pt-3 border-t border-ghost">
                        <button className="text-xs text-champagne hover:text-jet transition-colors font-medium">Edit</button>
                        <button className="text-xs text-slate hover:text-rose transition-colors">Remove</button>
                        {!addr.default && <button className="text-xs text-slate hover:text-jet transition-colors ml-auto">Set as default</button>}
                      </div>
                    </div>
                  ))}

                  {/* Add new card */}
                  <button className="border-2 border-dashed border-ghost rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-champagne transition-colors group min-h-[160px]">
                    <div className="w-10 h-10 rounded-full bg-[#FAF9F7] group-hover:bg-champagne/10 flex items-center justify-center transition-colors text-silver group-hover:text-champagne text-xl">
                      +
                    </div>
                    <p className="text-sm text-slate group-hover:text-charcoal transition-colors">Add a new address</p>
                  </button>
                </div>
              </div>
            )}

            {/* SETTINGS */}
            {tab === "settings" && (
              <div>
                <h1 className="font-display text-2xl font-semibold text-jet mb-6">Account Settings</h1>
                <div className="bg-[#FAF9F7] rounded-2xl p-6 border border-ghost max-w-lg">
                  <div className="flex flex-col gap-4">
                    {[
                      { name: "firstName", label: "First Name", value: "Sophia", type: "text" },
                      { name: "lastName", label: "Last Name", value: "Laurent", type: "text" },
                      { name: "email", label: "Email Address", value: "sophia@example.com", type: "email" },
                      { name: "phone", label: "Phone Number", value: "+91 98765 43210", type: "tel" },
                    ].map((f) => (
                      <div key={f.name}>
                        <label className="text-xs font-medium text-slate block mb-1.5">{f.label}</label>
                        <input
                          type={f.type}
                          defaultValue={f.value}
                          className="w-full border border-ghost rounded-xl px-4 py-3 text-sm text-jet outline-none focus:border-champagne transition-colors bg-white"
                        />
                      </div>
                    ))}
                    <button className="mt-2 bg-jet text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-charcoal transition-colors self-start">
                      Save Changes
                    </button>
                  </div>
                </div>

                <div className="mt-6 bg-[#FAF9F7] rounded-2xl p-6 border border-ghost max-w-lg">
                  <h3 className="font-semibold text-jet mb-1">Notifications</h3>
                  <p className="text-xs text-slate mb-4">Choose what you'd like to hear from us.</p>
                  {[
                    { label: "New arrivals & restocks", on: true },
                    { label: "Exclusive member offers", on: true },
                    { label: "Order updates", on: true },
                    { label: "Style inspiration & edits", on: false },
                  ].map((n) => (
                    <div key={n.label} className="flex items-center justify-between py-2.5 border-b border-ghost last:border-0">
                      <p className="text-sm text-charcoal">{n.label}</p>
                      <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${n.on ? "bg-jet" : "bg-ghost"}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${n.on ? "translate-x-5" : "translate-x-0.5"}`} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 max-w-lg">
                  <button className="text-sm text-rose hover:text-jet transition-colors flex items-center gap-2 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Delete my account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
