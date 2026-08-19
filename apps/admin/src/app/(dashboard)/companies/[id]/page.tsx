import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type {
  AgingBucketLabel,
  AgingReportView,
  Company,
  CompanyCreditAccountView,
  CompanyCreditTransactionView,
  CompanyMember,
} from '@/lib/types';
import { Badge, type badgeVariants } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { formatPrice } from '@/lib/format-price';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VariantProps } from 'class-variance-authority';
import { BalanceSummaryCard } from '@/components/balance-summary-card';
import { SetCompanyStatusDialog } from '../set-company-status-dialog';
import { AddMemberDialog } from '../add-member-dialog';
import { ChangeMemberRoleDialog } from '../change-member-role-dialog';
import { RemoveMemberDialog } from '../remove-member-dialog';
import { CompanyCreditTermsDialog, TERMS_LABELS } from '../company-credit-terms-dialog';
import { RecordCreditPaymentDialog } from '../record-credit-payment-dialog';
import { AdjustCreditDialog } from '../adjust-credit-dialog';
import { CreditStatusDialog } from '../credit-status-dialog';

const AGING_BUCKET_ORDER: AgingBucketLabel[] = ['current', '1-30', '31-60', '61-90', '90+'];
const AGING_BUCKET_LABELS: Record<AgingBucketLabel, string> = {
  current: 'Current',
  '1-30': '1-30 days',
  '31-60': '31-60 days',
  '61-90': '61-90 days',
  '90+': '90+ days',
};

const CREDIT_TXN_BADGE: Record<
  CompanyCreditTransactionView['type'],
  VariantProps<typeof badgeVariants>['variant']
> = {
  CHARGE: 'warning',
  PAYMENT: 'success',
  ADJUST: 'secondary',
  WRITE_OFF: 'destructive',
};

function agingBucketBadge(bucket: AgingBucketLabel): {
  variant: VariantProps<typeof badgeVariants>['variant'];
  className?: string;
} {
  switch (bucket) {
    case 'current':
      return { variant: 'success' };
    case '1-30':
      return { variant: 'warning' };
    case '31-60':
    case '61-90':
      return {
        variant: 'warning',
        className: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
      };
    case '90+':
      return { variant: 'destructive' };
  }
}

function InfoRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b px-3 py-2.5 text-sm odd:bg-muted/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  );
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [company, members, creditAccount, creditTransactions, agingReport] = await Promise.all([
    apiGet<Company>(`/admin/v1/companies/${id}`),
    apiGet<CompanyMember[]>(`/admin/v1/companies/${id}/members`),
    apiGet<CompanyCreditAccountView | null>(`/admin/v1/companies/${id}/credit`),
    apiGet<CompanyCreditTransactionView[]>(`/admin/v1/companies/${id}/credit/transactions`),
    apiGet<AgingReportView>(`/admin/v1/companies/${id}/credit/aging`),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/companies" className="text-sm text-muted-foreground hover:underline">
          ← Back to Companies
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
          <Badge variant={statusBadgeVariant(company.status)}>{company.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {company.code} · {company.websiteCode}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/companies/${company.publicId}/edit`}
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Edit
        </Link>
        {company.status === 'PENDING' ? (
          <>
            <SetCompanyStatusDialog
              publicId={company.publicId}
              targetStatus="ACTIVE"
              triggerLabel="Approve"
              title="Approve Company"
              description="Activates this company — its members can then place B2B orders."
              confirmLabel="Approve"
            />
            <SetCompanyStatusDialog
              publicId={company.publicId}
              targetStatus="REJECTED"
              triggerLabel="Reject"
              title="Reject Company"
              description="Marks this company's application as rejected. It can be approved later if needed."
              confirmLabel="Reject"
              confirmVariant="destructive"
            />
          </>
        ) : null}
        {company.status === 'ACTIVE' ? (
          <SetCompanyStatusDialog
            publicId={company.publicId}
            targetStatus="SUSPENDED"
            triggerLabel="Suspend"
            title="Suspend Company"
            description="Blocks this company's members from placing new B2B orders until reactivated."
            confirmLabel="Suspend"
            confirmVariant="destructive"
          />
        ) : null}
        {company.status === 'SUSPENDED' || company.status === 'REJECTED' ? (
          <SetCompanyStatusDialog
            publicId={company.publicId}
            targetStatus="ACTIVE"
            triggerLabel="Reactivate"
            title="Reactivate Company"
            description="Restores this company to Active — its members can place B2B orders again."
            confirmLabel="Reactivate"
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden rounded-lg border">
            <InfoRow label="Code" value={company.code} />
            <InfoRow label="Website" value={company.websiteCode} />
            <InfoRow
              label="Customer Group"
              value={company.customerGroupName ?? company.customerGroupCode ?? '—'}
            />
            <InfoRow label="Tax Exempt" value={company.taxExempt ? 'Yes' : 'No'} />
            {company.taxExempt ? (
              <InfoRow label="Tax Exemption Ref" value={company.taxExemptionRef ?? '—'} />
            ) : null}
            <InfoRow label="GSTIN" value={company.gstin ?? '—'} />
            <InfoRow label="Billing Contact" value={company.billingContactName ?? '—'} />
            <InfoRow label="Billing Email" value={company.billingContactEmail ?? '—'} />
            <InfoRow label="Billing Phone" value={company.billingContactPhone ?? '—'} />
            <InfoRow label="Created" value={new Date(company.createdAt).toLocaleString()} />
            <InfoRow label="Updated" value={new Date(company.updatedAt).toLocaleString()} />
          </div>
        </CardContent>
      </Card>

      <SectionCard title="Members" action={<AddMemberDialog publicId={company.publicId} />}>
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No members yet.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.customerPublicId}>
                    <TableCell className="font-medium">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant={m.role === 'ADMIN' ? 'default' : 'secondary'}>{m.role}</Badge>
                    </TableCell>
                    <TableCell>{new Date(m.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <ChangeMemberRoleDialog publicId={company.publicId} member={m} />
                        <RemoveMemberDialog
                          publicId={company.publicId}
                          customerPublicId={m.customerPublicId}
                          email={m.email}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {creditAccount === null ? (
        <SectionCard title="Credit">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This company doesn&apos;t have Net-X credit terms configured yet.
            </p>
            <CompanyCreditTermsDialog publicId={company.publicId} account={null} />
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title="Credit"
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <CompanyCreditTermsDialog publicId={company.publicId} account={creditAccount} />
              <RecordCreditPaymentDialog
                publicId={company.publicId}
                invoices={agingReport.invoices}
              />
              <AdjustCreditDialog publicId={company.publicId} />
              <CreditStatusDialog publicId={company.publicId} status={creditAccount.status} />
            </div>
          }
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <BalanceSummaryCard
                label="Credit Limit"
                value={creditAccount.creditLimit}
                currency={creditAccount.currency}
              />
              <BalanceSummaryCard
                label="Outstanding"
                value={creditAccount.outstanding}
                currency={creditAccount.currency}
              />
              <BalanceSummaryCard
                label="Available"
                value={creditAccount.available}
                currency={creditAccount.currency}
                status={creditAccount.status}
                footnote={`Terms: ${TERMS_LABELS[creditAccount.termsType]}`}
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Aging</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {AGING_BUCKET_ORDER.map((b) => (
                  <div key={b} className="rounded-md border p-2 text-center">
                    <div className="text-xs text-muted-foreground">{AGING_BUCKET_LABELS[b]}</div>
                    <div className="text-sm font-medium">
                      {formatPrice(agingReport.buckets[b], creditAccount.currency)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Bucket</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agingReport.invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No open invoices.
                        </TableCell>
                      </TableRow>
                    ) : (
                      agingReport.invoices.map((inv) => {
                        const badge = agingBucketBadge(inv.bucket);
                        return (
                          <TableRow key={inv.orderPublicId}>
                            <TableCell className="font-medium">
                              <Link
                                href={`/orders/${inv.orderPublicId}`}
                                className="hover:underline"
                              >
                                #{inv.orderNumber}
                              </Link>
                            </TableCell>
                            <TableCell>{formatPrice(inv.amount, inv.currency)}</TableCell>
                            <TableCell>
                              {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell>{inv.daysOverdue}</TableCell>
                            <TableCell>
                              <Badge variant={badge.variant} className={badge.className}>
                                {AGING_BUCKET_LABELS[inv.bucket]}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Transaction Ledger</h3>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Outstanding After</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No credit activity yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      creditTransactions.map((t, i) => (
                        <TableRow key={i}>
                          <TableCell>{new Date(t.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={CREDIT_TXN_BADGE[t.type]}>{t.type}</Badge>
                          </TableCell>
                          <TableCell
                            className={t.amount.startsWith('-') ? 'text-destructive' : undefined}
                          >
                            {formatPrice(t.amount, t.currency)}
                          </TableCell>
                          <TableCell>{formatPrice(t.outstandingAfter, t.currency)}</TableCell>
                          <TableCell>
                            {t.dueAt ? new Date(t.dueAt).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{t.reason ?? '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
