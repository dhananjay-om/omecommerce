import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { Company, Website } from '@/lib/types';
import { CompanyForm } from '../../company-form';

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [company, websites] = await Promise.all([
    apiGet<Company>(`/admin/v1/companies/${id}`),
    apiGet<Website[]>('/admin/v1/websites'),
  ]);

  return (
    <div>
      <div>
        <Link href={`/companies/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to {company.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit Company</h1>
      </div>
      <div className="mt-6">
        <CompanyForm company={company} websites={websites} />
      </div>
    </div>
  );
}
