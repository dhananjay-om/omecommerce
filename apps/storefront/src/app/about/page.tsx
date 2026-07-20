import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'About Us' };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">About OMEShop</h1>
      <div className="mt-6 flex flex-col gap-4 text-muted-foreground">
        <p>
          OMEShop is a demo storefront built on top of a full-featured commerce backend — real catalog, cart,
          checkout, and account management, all backed by a production-shaped API rather than mock data.
        </p>
        <p>
          Everything you can browse, add to your cart, and check out here uses the same endpoints a production
          storefront would — this page is one of the few that&apos;s just static content.
        </p>
      </div>
    </div>
  );
}
