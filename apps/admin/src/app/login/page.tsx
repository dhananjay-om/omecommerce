'use client';

import { useActionState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { login, type LoginFormState } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: LoginFormState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
            <ShoppingBag className="size-5" strokeWidth={2.25} />
          </div>
          <span className="text-lg font-bold tracking-tight">OMEcommerce</span>
        </div>
        <div>
          <h1 className="text-4xl leading-tight font-bold tracking-tight">
            Your commerce,
            <br />
            your way.
          </h1>
          <p className="mt-3 max-w-sm text-primary-foreground/80">
            One admin for catalog, inventory, pricing, orders, and customers.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">© {new Date().getFullYear()} OrangeMantra Technologies</p>
      </div>

      <div className="flex w-full flex-col items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="text-2xl leading-none font-bold tracking-tight">
              <span className="text-primary">orange</span>
              <span className="text-foreground">mantra</span>
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back. Enter your credentials to continue.</p>

          <form action={formAction} className="mt-8 space-y-4">
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
