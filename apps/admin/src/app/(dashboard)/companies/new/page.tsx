import { apiGet } from '@/lib/api-client';
import type { Website } from '@/lib/types';
import { BackLink } from '@/components/back-link';
import { CompanyForm } from '../company-form';

export default async function NewCompanyPage() {
  const websites = await apiGet<Website[]>('/admin/v1/websites');

  return (
    <div>
      <BackLink href="/companies" label="Back to Companies" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">New Company</h1>
      <div className="mt-6">
        <CompanyForm websites={websites} />
      </div>
    </div>
  );
}
