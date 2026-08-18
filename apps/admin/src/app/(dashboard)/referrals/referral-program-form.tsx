'use client';

import { useActionState, useState, type FormEvent } from 'react';
import { saveReferralProgram, type ActionState } from './actions';
import type { ReferralProgram, ReferralRewardType, ReferralQualifyingEvent, LoyaltyProgramStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const REWARD_TYPE_LABELS: Record<ReferralRewardType, string> = { STORE_CREDIT: 'Store Credit', POINTS: 'Loyalty Points' };
const QUALIFYING_EVENT_LABELS: Record<ReferralQualifyingEvent, string> = { SIGNUP: 'On sign-up', FIRST_ORDER: "On the referee's first paid order" };
const STATUS_LABELS: Record<LoyaltyProgramStatus, string> = { ACTIVE: 'Active', PAUSED: 'Paused', ENDED: 'Ended' };

const initialState: ActionState = { error: null, success: false };

/**
 * Client-side guard mirrors the DB's referral_reward_shape CHECK (exactly one
 * of amount/points, strictly positive) plus the POINTS-needs-a-loyalty-program
 * rule (validate-reward-shape.ts) — surfaced as a plain-English error here so
 * a bad configuration never round-trips to the API to find out.
 */
function validateReward(
  side: 'Referrer' | 'Referee',
  type: ReferralRewardType,
  amount: string,
  points: string,
  hasLoyaltyProgram: boolean,
): string | null {
  if (type === 'STORE_CREDIT') {
    if (!amount || Number(amount) <= 0) return `${side} reward amount must be a positive amount.`;
  } else {
    if (!points || !/^\d+$/.test(points) || Number(points) <= 0) return `${side} reward points must be a positive whole number.`;
    if (!hasLoyaltyProgram) return `${side} reward can't be Loyalty Points — this website has no loyalty program configured yet.`;
  }
  return null;
}

export function ReferralProgramForm({
  websiteCode,
  program,
  hasLoyaltyProgram,
}: {
  websiteCode: string;
  program: ReferralProgram | null;
  hasLoyaltyProgram: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveReferralProgram, initialState);
  const [clientError, setClientError] = useState<string | null>(null);
  const [referrerType, setReferrerType] = useState<ReferralRewardType>(program?.referrerRewardType ?? 'STORE_CREDIT');
  const [refereeType, setRefereeType] = useState<ReferralRewardType>(program?.refereeRewardType ?? 'STORE_CREDIT');
  const scope = program?.publicId ?? websiteCode;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const data = new FormData(e.currentTarget);
    const referrerError = validateReward(
      'Referrer',
      referrerType,
      String(data.get('referrerRewardAmount') ?? ''),
      String(data.get('referrerRewardPoints') ?? ''),
      hasLoyaltyProgram,
    );
    const refereeError = validateReward(
      'Referee',
      refereeType,
      String(data.get('refereeRewardAmount') ?? ''),
      String(data.get('refereeRewardPoints') ?? ''),
      hasLoyaltyProgram,
    );
    const error = referrerError ?? refereeError;
    if (error) {
      e.preventDefault();
      setClientError(error);
    } else {
      setClientError(null);
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <input type="hidden" name="mode" value={program ? 'update' : 'create'} />
      {program ? (
        <input type="hidden" name="programPublicId" value={program.publicId} />
      ) : (
        <input type="hidden" name="websiteCode" value={websiteCode} />
      )}

      <div className="space-y-2">
        <Label htmlFor={`ref-name-${scope}`}>Program name</Label>
        <Input id={`ref-name-${scope}`} name="name" required defaultValue={program?.name ?? ''} placeholder="e.g. Refer a Friend" />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`ref-qualifying-${scope}`}>Qualifying event</Label>
        <Select name="qualifyingEvent" defaultValue={program?.qualifyingEvent ?? 'SIGNUP'}>
          <SelectTrigger id={`ref-qualifying-${scope}`} className="w-full">
            <SelectValue>{(value: ReferralQualifyingEvent) => QUALIFYING_EVENT_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(QUALIFYING_EVENT_LABELS) as ReferralQualifyingEvent[]).map((v) => (
              <SelectItem key={v} value={v}>
                {QUALIFYING_EVENT_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`ref-min-order-${scope}`}>Minimum order amount</Label>
        <Input
          id={`ref-min-order-${scope}`}
          name="minOrderAmount"
          defaultValue={program?.minOrderAmount ?? ''}
          placeholder="Optional — only applies when qualifying on first order"
        />
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="text-sm font-semibold">Referrer reward</h4>
        <p className="mt-1 text-xs text-muted-foreground">Granted to the person who shared their referral link.</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`ref-referrer-type-${scope}`}>Reward type</Label>
            <Select name="referrerRewardType" value={referrerType} onValueChange={(v) => setReferrerType(v as ReferralRewardType)}>
              <SelectTrigger id={`ref-referrer-type-${scope}`} className="w-full">
                <SelectValue>{(value: ReferralRewardType) => REWARD_TYPE_LABELS[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REWARD_TYPE_LABELS) as ReferralRewardType[]).map((v) => (
                  <SelectItem key={v} value={v}>
                    {REWARD_TYPE_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`ref-referrer-value-${scope}`}>{referrerType === 'STORE_CREDIT' ? 'Amount' : 'Points'}</Label>
            {referrerType === 'STORE_CREDIT' ? (
              <Input
                id={`ref-referrer-value-${scope}`}
                name="referrerRewardAmount"
                defaultValue={program?.referrerRewardAmount ?? ''}
                placeholder="e.g. 10.00"
              />
            ) : (
              <Input
                id={`ref-referrer-value-${scope}`}
                name="referrerRewardPoints"
                defaultValue={program?.referrerRewardPoints ?? ''}
                placeholder="e.g. 500"
              />
            )}
          </div>
        </div>
        {!hasLoyaltyProgram && referrerType === 'POINTS' ? (
          <p className="mt-2 text-xs text-destructive">No loyalty program exists for this website yet — set one up first.</p>
        ) : null}
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="text-sm font-semibold">Referee reward</h4>
        <p className="mt-1 text-xs text-muted-foreground">Granted to the new customer who used the referral link.</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`ref-referee-type-${scope}`}>Reward type</Label>
            <Select name="refereeRewardType" value={refereeType} onValueChange={(v) => setRefereeType(v as ReferralRewardType)}>
              <SelectTrigger id={`ref-referee-type-${scope}`} className="w-full">
                <SelectValue>{(value: ReferralRewardType) => REWARD_TYPE_LABELS[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REWARD_TYPE_LABELS) as ReferralRewardType[]).map((v) => (
                  <SelectItem key={v} value={v}>
                    {REWARD_TYPE_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`ref-referee-value-${scope}`}>{refereeType === 'STORE_CREDIT' ? 'Amount' : 'Points'}</Label>
            {refereeType === 'STORE_CREDIT' ? (
              <Input
                id={`ref-referee-value-${scope}`}
                name="refereeRewardAmount"
                defaultValue={program?.refereeRewardAmount ?? ''}
                placeholder="e.g. 5.00"
              />
            ) : (
              <Input
                id={`ref-referee-value-${scope}`}
                name="refereeRewardPoints"
                defaultValue={program?.refereeRewardPoints ?? ''}
                placeholder="e.g. 250"
              />
            )}
          </div>
        </div>
        {!hasLoyaltyProgram && refereeType === 'POINTS' ? (
          <p className="mt-2 text-xs text-destructive">No loyalty program exists for this website yet — set one up first.</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`ref-max-${scope}`}>Max referrals per customer</Label>
          <Input
            id={`ref-max-${scope}`}
            name="maxReferralsPerCustomer"
            type="number"
            step="1"
            min="1"
            defaultValue={program?.maxReferralsPerCustomer ?? ''}
            placeholder="Unlimited"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`ref-window-${scope}`}>Attribution window (days)</Label>
          <Input
            id={`ref-window-${scope}`}
            name="attributionWindowDays"
            type="number"
            step="1"
            min="1"
            defaultValue={program?.attributionWindowDays ?? ''}
            placeholder="Unlimited"
          />
        </div>
      </div>

      {program ? (
        <div className="space-y-2">
          <Label htmlFor={`ref-status-${scope}`}>Status</Label>
          <Select name="status" defaultValue={program.status}>
            <SelectTrigger id={`ref-status-${scope}`} className="w-full">
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

      {clientError ? <p className="text-sm text-destructive">{clientError}</p> : null}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : program ? 'Save Changes' : 'Create Program'}
      </Button>
    </form>
  );
}
