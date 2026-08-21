import { BackLink } from '@/components/back-link';
import { CmsPageForm } from '../page-form';

export default function NewCmsPagePage() {
  return (
    <div>
      <BackLink href="/content/pages" label="Back to Pages" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">New Page</h1>
      <div className="mt-6">
        <CmsPageForm />
      </div>
    </div>
  );
}
