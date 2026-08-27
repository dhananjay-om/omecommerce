'use client';

export function NewsletterSection() {
  return (
    <section className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-sm text-center">
        <p className="font-display text-4xl leading-snug font-semibold text-jet sm:text-5xl">
          Good stuff,
          <br />
          <span className="text-champagne font-normal italic">straight to you.</span>
        </p>
        <p className="mt-4 text-sm leading-relaxed text-charcoal/55">
          New drops, honest style notes, and the occasional exclusive deal. No spam, ever.
        </p>
        <form className="mx-auto mt-8 flex max-w-sm gap-0 rounded-full border border-silver/40 bg-ivory shadow-md" onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            placeholder="your@email.com"
            required
            className="flex-1 bg-transparent px-5 py-3.5 text-sm text-jet outline-none"
          />
          <button type="submit" className="m-1 shrink-0 rounded-full bg-champagne px-5 py-3 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-jet">
            Subscribe
          </button>
        </form>
        <p className="mt-3 text-xs text-slate">Join 24,000+ people who already get it.</p>
      </div>
    </section>
  );
}
