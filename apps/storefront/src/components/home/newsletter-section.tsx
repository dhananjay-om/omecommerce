'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function NewsletterSection() {
  return (
    <section className="bg-primary py-12 text-primary-foreground">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 text-center">
        <h2 className="text-xl font-bold sm:text-2xl">Join Our Newsletter</h2>
        <p className="text-sm text-primary-foreground/85">Get 10% off your first order and updates on new arrivals.</p>
        <form className="mt-2 flex w-full max-w-md gap-2" onSubmit={(e) => e.preventDefault()}>
          <Input type="email" placeholder="Enter your email" required className="bg-background text-foreground" />
          <Button type="submit" variant="cta">
            Subscribe
          </Button>
        </form>
      </div>
    </section>
  );
}
