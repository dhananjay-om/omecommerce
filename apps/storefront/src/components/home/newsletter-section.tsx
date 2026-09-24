'use client';

import { useNewsletterSubscribe } from '@/components/newsletter/use-newsletter-subscribe';
import { Honeypot } from '@/components/newsletter/honeypot';

export function NewsletterSection() {
  const { state, onSubmit, loading } = useNewsletterSubscribe('home');

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
        <form className="relative mx-auto mt-8 flex max-w-sm gap-0 rounded-full border border-silver/40 bg-ivory shadow-md" onSubmit={onSubmit}>
          <input
            type="email"
            name="email"
            placeholder="your@email.com"
            aria-label="Email address"
            required
            disabled={loading}
            className="flex-1 bg-transparent px-5 py-3.5 text-sm text-jet outline-none disabled:opacity-60"
          />
          <Honeypot />
          <button
            type="submit"
            disabled={loading}
            className="m-1 shrink-0 rounded-full bg-champagne px-5 py-3 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-jet disabled:opacity-60"
          >
            {loading ? 'Subscribing…' : 'Subscribe'}
          </button>
        </form>
        <p role="status" aria-live="polite" className={`mt-3 text-xs ${state.kind === 'error' ? 'text-rose' : state.kind === 'success' ? 'text-green-700' : 'text-slate'}`}>
          {state.kind === 'success'
            ? "You're subscribed — thanks! Check your inbox for a welcome note."
            : state.kind === 'error'
              ? state.message
              : 'Unsubscribe any time with one click.'}
        </p>
      </div>
    </section>
  );
}
