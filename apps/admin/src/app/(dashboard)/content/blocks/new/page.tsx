import { BackLink } from '@/components/back-link';
import { CmsBlockForm } from '../block-form';

export default function NewCmsBlockPage() {
  return (
    <div>
      <BackLink href="/content/blocks" label="Back to Blocks" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">New Block</h1>
      <div className="mt-6">
        <CmsBlockForm />
      </div>
    </div>
  );
}
