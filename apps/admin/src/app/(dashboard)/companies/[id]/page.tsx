import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { Company, CompanyMember } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SetCompanyStatusDialog } from '../set-company-status-dialog';
import { AddMemberDialog } from '../add-member-dialog';
import { ChangeMemberRoleDialog } from '../change-member-role-dialog';
import { RemoveMemberDialog } from '../remove-member-dialog';

function InfoRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b px-3 py-2.5 text-sm odd:bg-muted/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
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
  const [company, members] = await Promise.all([
    apiGet<Company>(`/admin/v1/companies/${id}`),
    apiGet<CompanyMember[]>(`/admin/v1/companies/${id}/members`),
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
        <Link href={`/companies/${company.publicId}/edit`} className={cn(buttonVariants({ variant: 'outline' }))}>
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
            <InfoRow label="Customer Group" value={company.customerGroupName ?? company.customerGroupCode ?? '—'} />
            <InfoRow label="Tax Exempt" value={company.taxExempt ? 'Yes' : 'No'} />
            {company.taxExempt ? <InfoRow label="Tax Exemption Ref" value={company.taxExemptionRef ?? '—'} /> : null}
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
                        <RemoveMemberDialog publicId={company.publicId} customerPublicId={m.customerPublicId} email={m.email} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
