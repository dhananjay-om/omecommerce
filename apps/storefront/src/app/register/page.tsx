'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { register as registerRequest } from '@/services/customer.service';
import { attachReferral } from '@/services/rewards.service';
import { useAuthStore } from '@/store/auth-store';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().optional(),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

type FormValues = z.infer<typeof schema>;

/** useSearchParams() (to capture ?ref=<code>) needs a Suspense boundary — see the wrapping default export below. */
function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref');
  const hydrate = useAuthStore((s) => s.hydrate);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await registerRequest(values);
      await hydrate();
      // A captured ?ref= code is attached post-login, best-effort — a bad or
      // expired code must never block registration, so failures only toast.
      if (referralCode) {
        try {
          await attachReferral(referralCode);
          toast.success('Referral applied!');
        } catch {
          toast.error("That referral link couldn't be applied, but your account was created.");
        }
      }
      router.push('/account');
      router.refresh();
    } catch (err) {
      const message = isAxiosError(err) ? (err.response?.data?.error ?? 'Registration failed.') : 'Registration failed.';
      setServerError(message);
    }
  });

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-bold">Create an account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" autoComplete="given-name" {...registerField('firstName')} />
            {errors.firstName ? <p className="text-xs text-destructive">{errors.firstName.message}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" autoComplete="family-name" {...registerField('lastName')} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...registerField('email')} />
          {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...registerField('password')} />
          {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
        </div>
        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
        <Button type="submit" variant="cta" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
