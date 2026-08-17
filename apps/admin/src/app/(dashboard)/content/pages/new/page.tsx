import { CmsPageForm } from '../page-form';

export default function NewCmsPagePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">New Page</h1>
      <div className="mt-6">
        <CmsPageForm />
      </div>
    </div>
  );
}
