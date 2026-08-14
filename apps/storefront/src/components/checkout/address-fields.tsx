import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GST_STATES } from '@/lib/gst-states';
import type { CheckoutFormValues } from './checkout-schema';

export function AddressFields({
  prefix,
  register,
  errors,
}: {
  prefix: 'shippingAddress' | 'billingAddress';
  register: UseFormRegister<CheckoutFormValues>;
  errors: FieldErrors<CheckoutFormValues>;
}) {
  const fieldErrors = errors[prefix];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}.name`}>Full name</Label>
          <Input id={`${prefix}.name`} {...register(`${prefix}.name`)} />
          {fieldErrors?.name ? <p className="text-xs text-destructive">{fieldErrors.name.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}.phone`}>Phone</Label>
          <Input id={`${prefix}.phone`} {...register(`${prefix}.phone`)} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefix}.line1`}>Address line 1</Label>
        <Input id={`${prefix}.line1`} {...register(`${prefix}.line1`)} />
        {fieldErrors?.line1 ? <p className="text-xs text-destructive">{fieldErrors.line1.message}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefix}.line2`}>Address line 2</Label>
        <Input id={`${prefix}.line2`} {...register(`${prefix}.line2`)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}.city`}>City</Label>
          <Input id={`${prefix}.city`} {...register(`${prefix}.city`)} />
          {fieldErrors?.city ? <p className="text-xs text-destructive">{fieldErrors.city.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}.region`}>State / Region</Label>
          <Input id={`${prefix}.region`} {...register(`${prefix}.region`)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}.postalCode`}>Postal code</Label>
          <Input id={`${prefix}.postalCode`} {...register(`${prefix}.postalCode`)} />
          {fieldErrors?.postalCode ? <p className="text-xs text-destructive">{fieldErrors.postalCode.message}</p> : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:w-40">
          <Label htmlFor={`${prefix}.country`}>Country code</Label>
          <Input id={`${prefix}.country`} placeholder="US" maxLength={2} {...register(`${prefix}.country`)} />
          {fieldErrors?.country ? <p className="text-xs text-destructive">{fieldErrors.country.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}.stateCode`}>GST state (India orders)</Label>
          <select
            id={`${prefix}.stateCode`}
            {...register(`${prefix}.stateCode`)}
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">Not applicable</option>
            {GST_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefix}.gstin`}>GSTIN (optional, for a business invoice)</Label>
        <Input id={`${prefix}.gstin`} placeholder="e.g. 27AAAAA0000A1Z5" maxLength={15} {...register(`${prefix}.gstin`)} />
      </div>
    </div>
  );
}
