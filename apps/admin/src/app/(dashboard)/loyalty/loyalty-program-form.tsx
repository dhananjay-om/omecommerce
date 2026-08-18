'use client';

import { useActionState } from 'react';
import { saveLoyaltyProgram, type ActionState } from './actions';
import type { LoyaltyProgram, LoyaltyProgramStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_LABELS: Record<LoyaltyProgramStatus, string> = { ACTIVE: 'Active', PAUSED: 'Paused', ENDED: 'Ended' };

const initialState: ActionState = { error: null, success: false };

/** Create-or-edit in one form, like GstSettingsForm — but unlike GST (a field on
 *  Website itself), LoyaltyProgram is a separate resource that may not exist yet
 *  for this website (create), or already does (edit, including a Status control
 *  create can't set — new programs always start ACTIVE). */
export function LoyaltyProgramForm({ websiteCode, program }: { websiteCode: string; program: LoyaltyProgram | null }) {
  const [state, formAction, pending] = useActionState(saveLoyaltyProgram, initialState);
  const scope = program?.publicId ?? websiteCode;

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <input type="hidden" name="mode" value={program ? 'update' : 'create'} />
      {program ? (
        <input type="hidden" name="programPublicId" value={program.publicId} />
      ) : (
        <input type="hidden" name="websiteCode" value={websiteCode} />
      )}

      <div className="space-y-2">
        <Label htmlFor={`loyalty-name-${scope}`}>Program name</Label>
        <Input id={`loyalty-name-${scope}`} name="name" required defaultValue={program?.name ?? ''} placeholder="e.g. Rewards Club" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`loyalty-earn-${scope}`}>Points per currency unit</Label>
          <Input
            id={`loyalty-earn-${scope}`}
            name="pointsPerCurrencyUnit"
            required
            defaultValue={program?.pointsPerCurrencyUnit ?? ''}
            placeholder="e.g. 1"
          />
          <p className="text-xs text-muted-foreground">Points earned per unit of the order total.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`loyalty-value-${scope}`}>Value per point</Label>
          <Input
            id={`loyalty-value-${scope}`}
            name="pointValue"
            required
            defaultValue={program?.pointValue ?? ''}
            placeholder="e.g. 0.10"
          />
          <p className="text-xs text-muted-foreground">Store-credit value of one point on redemption.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`loyalty-min-${scope}`}>Minimum points to redeem</Label>
          <Input
            id={`loyalty-min-${scope}`}
            name="redeemMinPoints"
            type="number"
            step="1"
            min="0"
            defaultValue={program?.redeemMinPoints ?? 0}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`loyalty-expiry-${scope}`}>Points expire after (months)</Label>
          <Input
            id={`loyalty-expiry-${scope}`}
            name="pointsExpiryMonths"
            type="number"
            step="1"
            min="1"
            defaultValue={program?.pointsExpiryMonths ?? ''}
            placeholder="Never"
          />
        </div>
      </div>

      {program ? (
        <div className="space-y-2">
          <Label htmlFor={`loyalty-status-${scope}`}>Status</Label>
          <Select name="status" defaultValue={program.status}>
            <SelectTrigger id={`loyalty-status-${scope}`} className="w-full">
              <SelectValue>{(value: LoyaltyProgramStatus) => STATUS_LABELS[value]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as LoyaltyProgramStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : program ? 'Save Changes' : 'Create Program'}
      </Button>
    </form>
  );
}
