'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function NewsletterSection() {
  return (
    <section className="bg-jet py-16 text-white">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 text-center sm:px-6">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">
          Stay in the <span className="text-champagne italic">edit.</span>
        </h2>
        <p className="text-sm text-white/60">Get 10% off your first order and updates on new arrivals.</p>
        <form
          className="mt-3 flex w-full max-w-md overflow-hidden rounded-full border border-white/20 shadow-md"
          onSubmit={(e) => e.preventDefault()}
        >
          <Input
            type="email"
            placeholder="Enter your email"
            required
            className="rounded-none border-0 bg-transparent px-4 text-white placeholder:text-white/40 focus-visible:ring-0"
          />
          {/* Champagne override — see the footer's identical note: the default
              cta button is jet, which would vanish on this jet background. */}
          <Button type="submit" variant="cta" className="shrink-0 rounded-none bg-champagne px-5 hover:bg-champagne/90">
            Subscribe
          </Button>
        </form>
      </div>
    </section>
  );
}
