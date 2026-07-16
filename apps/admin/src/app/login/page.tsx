'use client';

import { useActionState } from 'react';
import { login, type LoginFormState } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const initialState: LoginFormState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-accent/40 via-background to-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-3xl leading-none font-bold tracking-tight">
            <span className="text-primary">orange</span>
            <span className="text-foreground">mantra</span>
          </span>
          <p className="mt-1 text-sm text-muted-foreground">OMEcommerce Admin</p>
        </div>
        <Card className="border-border/60 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Sign in with your admin account</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
