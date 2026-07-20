'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrashIcon } from '@heroicons/react/24/outline';
import type { CustomerAddress } from '@/types/customer';

const schema = z.object({
  name: z.string().min(1, 'Name is required.'),
  line1: z.string().min(1, 'Address is required.'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required.'),
  region: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required.'),
  country: z
    .string()
    .length(2, 'Use a 2-letter country code (e.g. US).')
    .transform((v) => v.toUpperCase()),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Backend has no update/set-default endpoint (plan/14 Phase 6 decision) —
 * "editing" an address is add-new + delete-old, same as the backend's own
 * scope cut.
 */
export function AddressList({ initialAddresses }: { initialAddresses: CustomerAddress[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [showForm, setShowForm] = useState(initialAddresses.length === 0);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await api.post<CustomerAddress>('/account/addresses', values);
      setAddresses((prev) => [...prev, res.data]);
      reset();
      setShowForm(false);
      toast.success('Address added');
    } catch (err) {
      const message = isAxiosError(err) ? (err.response?.data?.error ?? 'Could not add address.') : 'Could not add address.';
      toast.error(message);
    }
  });

  async function remove(publicId: string) {
    try {
      await api.delete(`/account/addresses/${publicId}`);
      setAddresses((prev) => prev.filter((a) => a.publicId !== publicId));
      toast.success('Address removed');
    } catch {
      toast.error('Could not remove address.');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Addresses</h2>
        {!showForm ? (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Add Address
          </Button>
        ) : null}
      </div>

      {addresses.length === 0 && !showForm ? <p className="text-muted-foreground">No saved addresses yet.</p> : null}

      <div className="flex flex-col gap-3">
        {addresses.map((address) => (
          <div key={address.publicId} className="flex items-start justify-between rounded-lg border p-4">
            <div className="text-sm">
              <p className="font-medium">{address.name}</p>
              {address.company ? <p className="text-muted-foreground">{address.company}</p> : null}
              <p>{address.line1}</p>
              {address.line2 ? <p>{address.line2}</p> : null}
              <p>
                {address.city}
                {address.region ? `, ${address.region}` : ''} {address.postalCode}
              </p>
              <p>{address.country}</p>
              {address.phone ? <p className="text-muted-foreground">{address.phone}</p> : null}
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Remove address" onClick={() => remove(address.publicId)}>
              <TrashIcon className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 rounded-lg border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" {...register('name')} />
              {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line1">Address line 1</Label>
            <Input id="line1" {...register('line1')} />
            {errors.line1 ? <p className="text-xs text-destructive">{errors.line1.message}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line2">Address line 2</Label>
            <Input id="line2" {...register('line2')} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register('city')} />
              {errors.city ? <p className="text-xs text-destructive">{errors.city.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="region">State / Region</Label>
              <Input id="region" {...register('region')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" {...register('postalCode')} />
              {errors.postalCode ? <p className="text-xs text-destructive">{errors.postalCode.message}</p> : null}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:w-40">
            <Label htmlFor="country">Country code</Label>
            <Input id="country" placeholder="US" maxLength={2} {...register('country')} />
            {errors.country ? <p className="text-xs text-destructive">{errors.country.message}</p> : null}
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="cta" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Address'}
            </Button>
            {addresses.length > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
