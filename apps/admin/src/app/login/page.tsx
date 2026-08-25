'use client';

import { useActionState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { login, type LoginFormState } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: LoginFormState = { error: null };

/** Small brand mark — same icon/wordmark/type scale as the sidebar's own
 *  (components/app-sidebar.tsx), reused here instead of this page having
 *  its own separate "orangemantra" wordmark and a third "OrangeMantra
 *  Technologies" string in the footer — 3 different brand identities on
 *  one small page was part of what read as messy. */
function BrandMark({ tone = 'default' }: { tone?: 'default' | 'onDark' }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={tone === 'onDark' ? 'flex size-8 items-center justify-center rounded-lg bg-white/15' : 'flex size-8 items-center justify-center rounded-lg bg-primary'}>
        <ShoppingBag className={tone === 'onDark' ? 'size-4.5' : 'size-4.5 text-primary-foreground'} strokeWidth={2.25} />
      </div>
      <span className="text-sm font-bold tracking-tight">OMEcommerce</span>
    </div>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    // Centered, bounded card instead of a full-bleed 50/50 split — a split
    // screen that stretches edge-to-edge scales badly on a wide monitor:
    // both halves' content stays a fixed width, so the gap between them
    // grows into a large dead gutter, and everything reads as stranded at
    // the left/right edges instead of one composed page (caught live via
    // a screenshot at 1600px). Capping the whole thing at max-w-4xl and
    // centering it on a neutral page background keeps it looking the same
    // — proportioned, intentional — at any viewport width.
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-card shadow-xl ring-1 ring-foreground/10 lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
          <BrandMark tone="onDark" />
          <div>
            <h1 className="text-2xl leading-tight font-bold tracking-tight">
              Your commerce,
              <br />
              your way.
            </h1>
            <p className="mt-2 max-w-xs text-sm text-primary-foreground/75">One admin for catalog, inventory, pricing, orders, and customers.</p>
          </div>
          <p className="text-xs text-primary-foreground/50">© {new Date().getFullYear()} OMEcommerce</p>
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-10">
          <div className="mb-6 lg:hidden">
            <BrandMark />
          </div>
          <h2 className="text-[1.32rem] font-extrabold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back. Enter your credentials to continue.</p>

          <form action={formAction} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="username" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <Button type="submit" className="w-full" size="lg" disabled={pending}>
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
