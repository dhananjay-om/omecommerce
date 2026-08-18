import { getMyReferrals, getReferralProgram } from '@/services/referral.service';
import { ApiError } from '@/lib/api-client';
import { ReferralCodePanel } from '@/components/account/referral-code-panel';
import type { MyReferrals, PublicReferralProgram, Referral, ReferralReward, ReferralStatus } from '@/types/referral';

export const metadata = { title: 'Referrals' };

function statusColor(status: ReferralStatus): string {
  switch (status) {
    case 'REWARDED':
      return 'text-success';
    case 'REVERSED':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}

function statusLabel(status: ReferralStatus): string {
  switch (status) {
    case 'SIGNED_UP':
      return 'Signed up';
    case 'QUALIFIED':
      return 'Qualified';
    case 'REWARDED':
      return 'Rewarded';
    case 'EXPIRED':
      return 'Expired';
    case 'REVERSED':
      return 'Reversed';
  }
}

function rewardTerm(type: 'STORE_CREDIT' | 'POINTS', amount: string | null, points: string | null): string {
  return type === 'POINTS' ? `${points} points` : `${amount} store credit`;
}

function rewardEarned(reward: ReferralReward | null): string {
  if (!reward) return '—';
  return reward.rewardType === 'POINTS' ? `${reward.points} pts` : (reward.amount ?? '—');
}

/** No ACTIVE referral program is treated as "no referral offer here" — a
 *  perfectly normal state (plan/15 Phase 4), not a broken page. */
async function loadReferrals(): Promise<MyReferrals | null> {
  try {
    return await getMyReferrals();
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

async function loadProgram(): Promise<PublicReferralProgram | null> {
  try {
    return await getReferralProgram();
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export default async function ReferralsPage() {
  const [data, program] = await Promise.all([loadReferrals(), loadProgram()]);

  if (!data) {
    return (
      <div>
        <h2 className="text-lg font-semibold">Referrals</h2>
        <p className="mt-2 text-muted-foreground">This store doesn&apos;t have a referral program right now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Referrals{program ? ` — ${program.name}` : ''}</h2>
        {program ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Share your link — you get {rewardTerm(program.referrerRewardType, program.referrerRewardAmount, program.referrerRewardPoints)} and your
            friend gets {rewardTerm(program.refereeRewardType, program.refereeRewardAmount, program.refereeRewardPoints)}
            {program.qualifyingEvent === 'FIRST_ORDER' ? ' once they place their first order' : ' as soon as they sign up'}.
          </p>
        ) : null}
      </div>

      <ReferralCodePanel code={data.code} />

      {data.referrals.length === 0 ? (
        <p className="text-muted-foreground">You haven&apos;t referred anyone yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Signed up</th>
                <th className="px-4 py-2 font-medium">Qualified</th>
                <th className="px-4 py-2 text-right font-medium">Your reward</th>
              </tr>
            </thead>
            <tbody>
              {data.referrals.map((r: Referral) => (
                <tr key={r.publicId} className="border-b last:border-b-0">
                  <td className={`px-4 py-3 font-medium ${statusColor(r.status)}`}>{statusLabel(r.status)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.qualifiedAt ? new Date(r.qualifiedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{rewardEarned(r.referrerReward)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
