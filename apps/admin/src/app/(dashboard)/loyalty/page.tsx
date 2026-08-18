import { apiGet } from '@/lib/api-client';
import type { Website, LoyaltyProgram, LoyaltyTier } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoyaltyProgramForm } from './loyalty-program-form';
import { TiersTable } from './tiers-table';

export default async function LoyaltyPage() {
  const [websites, programs] = await Promise.all([
    apiGet<Website[]>('/admin/v1/websites'),
    apiGet<LoyaltyProgram[]>('/admin/v1/loyalty/programs'),
  ]);

  const byWebsiteCode = new Map(programs.map((p) => [p.websiteCode, p]));
  const tiersByProgram = new Map(
    await Promise.all(
      programs.map(async (p) => [p.publicId, await apiGet<LoyaltyTier[]>(`/admin/v1/loyalty/programs/${p.publicId}/tiers`)] as const),
    ),
  );

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Loyalty Program</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Points are earned and clawed back fully automatically — earned when an order is paid, reversed
          proportionally on refund. There is nothing to trigger manually here; this page only configures the
          rates, tiers, and redemption rules each program applies.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {websites.map((w) => {
          const program = byWebsiteCode.get(w.code) ?? null;
          return (
            <Card key={w.code}>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-base">
                  {w.name} <span className="font-normal text-muted-foreground">({w.code})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <LoyaltyProgramForm websiteCode={w.code} program={program} />
                {program ? <TiersTable programPublicId={program.publicId} tiers={tiersByProgram.get(program.publicId) ?? []} /> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
