'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { api } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
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
  isDefaultShipping: z.boolean(),
  isDefaultBilling: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const BLANK_VALUES: FormValues = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  phone: '',
  isDefaultShipping: false,
  isDefaultBilling: false,
};

/**
 * Backend has no update/set-default-on-an-EXISTING-address endpoint (plan/14
 * Phase 6 decision) — "editing" an address is add-new + delete-old, same as
 * the backend's own scope cut. It DOES accept isDefaultShipping/
 * isDefaultBilling at creation time (correctly unsetting whichever address
 * previously held that flag) — plan/16's checkout auto-selects whichever
 * address carries the flag, so setting it here is what makes that work.
 *
 * "Editing" (plan/16) is built on that same add-new + delete-old shape:
 * clicking Edit pre-fills the form from the address being edited and tracks
 * it in `editingAddress`; submitting creates the replacement first, and only
 * deletes the original once that succeeds — never the other way around, so
 * a failed create never leaves the shopper with zero addresses.
 */
export function AddressList({ initialAddresses }: { initialAddresses: CustomerAddress[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [showForm, setShowForm] = useState(initialAddresses.length === 0);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: BLANK_VALUES,
  });
  const isDefaultShipping = watch('isDefaultShipping');
  const isDefaultBilling = watch('isDefaultBilling');

  function startAdd() {
    setEditingAddress(null);
    reset(BLANK_VALUES);
    setShowForm(true);
  }

  function startEdit(address: CustomerAddress) {
    setEditingAddress(address);
    reset({
      name: address.name,
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      region: address.region ?? '',
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone ?? '',
      isDefaultShipping: address.isDefaultShipping,
      isDefaultBilling: address.isDefaultBilling,
    });
    setShowForm(true);
  }

  function cancelForm() {
    setEditingAddress(null);
    reset(BLANK_VALUES);
    setShowForm(false);
  }

  const onSubmit = handleSubmit(async (values) => {
    const replacingId = editingAddress?.publicId ?? null;
    try {
      const res = await api.post<CustomerAddress>('/account/addresses', values);
      // Only remove the original once the replacement has actually been
      // created — a failed create above throws before this line, so a
      // shopper editing their only address never ends up with none.
      if (replacingId) {
        try {
          await api.delete(`/account/addresses/${replacingId}`);
        } catch {
          // The new address exists either way — surface this as a distinct,
          // honest warning rather than claiming a clean "Address updated"
          // when the old one is still sitting there duplicated.
          setAddresses((prev) => [...prev, res.data]);
          reset(BLANK_VALUES);
          setShowForm(false);
          setEditingAddress(null);
          toast.warning(
            'Saved the new address, but could not remove the old one — please delete it manually.',
          );
          return;
        }
      }
      setAddresses((prev) => [
        // The backend unsets whichever address previously held the default
        // shipping/billing flag when a new one is created with it set —
        // mirror that here so the UI doesn't show two "Default" badges
        // until the next page load.
        ...prev
          .filter((a) => a.publicId !== replacingId)
          .map((a) => ({
            ...a,
            isDefaultShipping: values.isDefaultShipping ? false : a.isDefaultShipping,
            isDefaultBilling: values.isDefaultBilling ? false : a.isDefaultBilling,
          })),
        res.data,
      ]);
      reset(BLANK_VALUES);
      setShowForm(false);
      setEditingAddress(null);
      toast.success(replacingId ? 'Address updated' : 'Address added');
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data?.error ?? 'Could not save address.')
        : 'Could not save address.';
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
        <h2 className="text-lg font-semibold text-jet">Addresses</h2>
        {!showForm ? (
          <Button variant="outline" size="sm" onClick={startAdd}>
            Add Address
          </Button>
        ) : null}
      </div>

      {addresses.length === 0 && !showForm ? (
        <p className="text-slate">No saved addresses yet.</p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {addresses.map((address) => (
          <div
            key={address.publicId}
            className={cn(
              'flex items-start justify-between rounded-2xl border-2 p-4',
              address.isDefaultShipping || address.isDefaultBilling ? 'border-champagne' : 'border-ghost',
            )}
          >
            <div className="text-sm">
              <p className="flex flex-wrap items-center gap-1.5 font-medium text-jet">
                {address.name}
                {address.isDefaultShipping ? (
                  <Badge className="bg-champagne text-white">Default shipping</Badge>
                ) : null}
                {address.isDefaultBilling ? (
                  <Badge className="bg-champagne text-white">Default billing</Badge>
                ) : null}
              </p>
              {address.company ? <p className="text-slate">{address.company}</p> : null}
              <p className="text-charcoal">{address.line1}</p>
              {address.line2 ? <p className="text-charcoal">{address.line2}</p> : null}
              <p className="text-charcoal">
                {address.city}
                {address.region ? `, ${address.region}` : ''} {address.postalCode}
              </p>
              <p className="text-charcoal">{address.country}</p>
              {address.phone ? <p className="text-slate">{address.phone}</p> : null}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit address"
                onClick={() => startEdit(address)}
              >
                <PencilIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove address"
                onClick={() => remove(address.publicId)}
              >
                <TrashIcon className="size-4 text-rose" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 rounded-2xl border border-ghost p-4">
          <h3 className="text-sm font-semibold text-jet">
            {editingAddress ? 'Edit address' : 'New address'}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" {...register('name')} />
              {errors.name ? (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line1">Address line 1</Label>
            <Input id="line1" {...register('line1')} />
            {errors.line1 ? (
              <p className="text-xs text-destructive">{errors.line1.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line2">Address line 2</Label>
            <Input id="line2" {...register('line2')} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register('city')} />
              {errors.city ? (
                <p className="text-xs text-destructive">{errors.city.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="region">State / Region</Label>
              <Input id="region" {...register('region')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" {...register('postalCode')} />
              {errors.postalCode ? (
                <p className="text-xs text-destructive">{errors.postalCode.message}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:w-40">
            <Label htmlFor="country">Country code</Label>
            <Input id="country" placeholder="US" maxLength={2} {...register('country')} />
            {errors.country ? (
              <p className="text-xs text-destructive">{errors.country.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isDefaultShipping}
                onCheckedChange={(checked) => setValue('isDefaultShipping', checked === true)}
              />
              Set as default shipping address
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isDefaultBilling}
                onCheckedChange={(checked) => setValue('isDefaultBilling', checked === true)}
              />
              Set as default billing address
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="cta" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingAddress ? 'Save Changes' : 'Save Address'}
            </Button>
            {addresses.length > 0 ? (
              <Button type="button" variant="ghost" onClick={cancelForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
