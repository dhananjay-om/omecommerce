import { apiGet } from '@/lib/api-client';
import { getMyCompany, getMyCompanyMembers } from '@/services/company.service';
import { CompanyMemberManager } from '@/components/account/company-member-manager';
import type { Customer } from '@/types/customer';

export const metadata = { title: 'Company' };

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending approval',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  REJECTED: 'Rejected',
};

export default async function CompanyPage() {
  const { company, myRole } = await getMyCompany();

  if (!company) {
    return (
      <div>
        <h2 className="text-lg font-semibold">Company</h2>
        <p className="mt-2 text-muted-foreground">You&apos;re not a member of a company account. Contact your organization&apos;s administrator to be added.</p>
      </div>
    );
  }

  const [customer, members] = await Promise.all([
    apiGet<Customer>('/store/v1/me', { auth: true }),
    myRole === 'ADMIN' ? getMyCompanyMembers() : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">{company.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {company.code} &middot; {STATUS_LABEL[company.status] ?? company.status} &middot; Your role: {myRole}
        </p>
      </div>

      {company.status !== 'ACTIVE' ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          This company account isn&apos;t active yet — company pricing and tax terms won&apos;t apply to your orders until it is.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4 text-sm">
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Pricing</h3>
          <p>{company.customerGroupName ?? 'Base (retail) pricing'}</p>
        </div>
        <div className="rounded-lg border p-4 text-sm">
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Tax</h3>
          <p>{company.taxExempt ? 'Tax exempt' : 'Standard tax applies'}</p>
          {company.gstin ? <p className="mt-1 text-muted-foreground">GSTIN: {company.gstin}</p> : null}
        </div>
      </div>

      {(company.billingContactName || company.billingContactEmail || company.billingContactPhone) && (
        <div className="rounded-lg border p-4 text-sm">
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Billing contact</h3>
          {company.billingContactName ? <p>{company.billingContactName}</p> : null}
          {company.billingContactEmail ? <p className="text-muted-foreground">{company.billingContactEmail}</p> : null}
          {company.billingContactPhone ? <p className="text-muted-foreground">{company.billingContactPhone}</p> : null}
        </div>
      )}

      {myRole === 'ADMIN' && members ? <CompanyMemberManager initialMembers={members} ownCustomerPublicId={customer.publicId} /> : null}
    </div>
  );
}
