import { apiGet } from '@/lib/api-client';
import type { Website } from '@/lib/types';
import { CompanyForm } from '../company-form';

export default async function NewCompanyPage() {
  const websites = await apiGet<Website[]>('/admin/v1/websites');

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">New Company</h1>
      <div className="mt-6">
        <CompanyForm websites={websites} />
      </div>
    </div>
  );
}
