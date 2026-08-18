import { apiGet } from '@/lib/api-client';
import type { MyReferrals, ReferralReward } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function renderReward(reward: ReferralReward | null): string {
  if (!reward) return '—';
  return reward.rewardType === 'POINTS' ? `${reward.points} pts` : (reward.amount ?? '—');
}

/** Read-only — a referral's lifecycle (qualify, reward, clawback) is entirely
 *  event-driven; there is nothing an admin can trigger here. */
export default async function CustomerReferralsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await apiGet<MyReferrals>(`/admin/v1/customers/${id}/referrals`);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">Referral code</div>
        <div className="mt-1 font-mono text-lg font-semibold">{data.code}</div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Referrer Reward</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Qualified</TableHead>
              <TableHead>Rewarded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.referrals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  This customer hasn&apos;t referred anyone yet.
                </TableCell>
              </TableRow>
            ) : (
              data.referrals.map((r) => (
                <TableRow key={r.publicId}>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                  </TableCell>
                  <TableCell>{renderReward(r.referrerReward)}</TableCell>
                  <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{r.qualifiedAt ? new Date(r.qualifiedAt).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>{r.rewardedAt ? new Date(r.rewardedAt).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
