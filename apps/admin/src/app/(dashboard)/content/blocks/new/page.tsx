import { CmsBlockForm } from '../block-form';

export default function NewCmsBlockPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">New Block</h1>
      <div className="mt-6">
        <CmsBlockForm />
      </div>
    </div>
  );
}
