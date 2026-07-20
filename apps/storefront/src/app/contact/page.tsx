'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { EnvelopeIcon, PhoneIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

/** No support-ticketing backend exists — the form is present but non-functional, same honesty pattern as the cart's coupon field. */
export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold">Contact Us</h1>
      <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex items-start gap-3">
            <PhoneIcon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Phone</p>
              <p className="text-muted-foreground">+1 (800) 555-0199</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <EnvelopeIcon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Email</p>
              <p className="text-muted-foreground">support@omeshop.example</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPinIcon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Ships to</p>
              <p className="text-muted-foreground">United States</p>
            </div>
          </div>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
            toast.success('Message sent — we’ll get back to you soon.');
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required disabled={submitted} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required disabled={submitted} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" rows={5} required disabled={submitted} />
          </div>
          <Button type="submit" variant="cta" disabled={submitted}>
            {submitted ? 'Sent' : 'Send Message'}
          </Button>
        </form>
      </div>
    </div>
  );
}
