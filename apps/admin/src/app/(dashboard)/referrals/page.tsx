import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { Website, LoyaltyProgram, ReferralProgram, ReferralReward, AdminReferralList, ReferralStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ReferralProgramForm } from './referral-program-form';

const PAGE_SIZE = 20;

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function renderReward(reward: ReferralReward | null): string {
  if (!reward) return '—';
  return reward.rewardType === 'POINTS' ? `${reward.points} pts` : (reward.amount ?? '—');
}

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: ReferralStatus }> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const [websites, programs, loyaltyPrograms, report] = await Promise.all([
    apiGet<Website[]>('/admin/v1/websites'),
    apiGet<ReferralProgram[]>('/admin/v1/referral/programs'),
    apiGet<LoyaltyProgram[]>('/admin/v1/loyalty/programs'),
    apiGet<AdminReferralList>(`/admin/v1/referral/referrals${buildQuery({ page, pageSize: PAGE_SIZE, status: params.status })}`),
  ]);

  const programByWebsiteCode = new Map(programs.map((p) => [p.websiteCode, p]));
  const websitesWithLoyalty = new Set(loyaltyPrograms.map((p) => p.websiteCode));
  const totalPages = Math.max(1, Math.ceil(report.total / report.pageSize));

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Referrals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Qualification, attribution, and reward issuance all happen automatically as referred customers
          sign up and order — this page only configures each website&apos;s program and shows the report below.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {websites.map((w) => {
          const program = programByWebsiteCode.get(w.code) ?? null;
          return (
            <Card key={w.code}>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-base">
                  {w.name} <span className="font-normal text-muted-foreground">({w.code})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ReferralProgramForm websiteCode={w.code} program={program} hasLoyaltyProgram={websitesWithLoyalty.has(w.code)} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Referral Report</h2>

        <form className="mt-4 flex flex-wrap items-center gap-2" action="/referrals">
          <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
            <option value="">All statuses</option>
            {(['SIGNED_UP', 'QUALIFIED', 'REWARDED', 'EXPIRED', 'REVERSED'] as ReferralStatus[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {params.status ? (
            <Link href="/referrals" className={cn(buttonVariants({ variant: 'ghost' }))}>
              Clear
            </Link>
          ) : null}
        </form>

        <div className="mt-4 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Referee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Referrer Reward</TableHead>
                <TableHead>Referee Reward</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Qualified</TableHead>
                <TableHead>Rewarded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.referrals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No referrals found.
                  </TableCell>
                </TableRow>
              ) : (
                report.referrals.map((r) => (
                  <TableRow key={r.publicId}>
                    <TableCell>{r.referrerEmail}</TableCell>
                    <TableCell>{r.refereeEmail}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>{renderReward(r.referrerReward)}</TableCell>
                    <TableCell>{renderReward(r.refereeReward)}</TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{r.qualifiedAt ? new Date(r.qualifiedAt).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>{r.rewardedAt ? new Date(r.rewardedAt).toLocaleDateString() : '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {report.total} referral{report.total === 1 ? '' : 's'} · page {report.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            ) : (
              <Link
                href={`/referrals${buildQuery({ page: page - 1, status: params.status })}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Previous
              </Link>
            )}
            {page >= totalPages ? (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            ) : (
              <Link
                href={`/referrals${buildQuery({ page: page + 1, status: params.status })}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
