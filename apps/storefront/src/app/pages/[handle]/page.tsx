import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCmsPage } from '@/services/content.service';
import { ApiError } from '@/lib/api-client';

interface Props {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  try {
    const page = await getCmsPage(handle);
    return { title: page.title };
  } catch {
    return {};
  }
}

/** Generic CMS page renderer — any admin-created Page (Shipping Policy,
 *  Terms of Service, etc.) shows up here at /pages/:handle with no code
 *  changes needed. `body` is intentionally raw HTML (see cms.prisma's
 *  header comment: "no blocks/widgets sub-content system... body is a
 *  single text/HTML field") — admin-authored via the Content admin only,
 *  same trust boundary as the admin's own Edit/Preview toggle. */
export default async function CmsPageRoute({ params }: Props) {
  const { handle } = await params;

  let page;
  try {
    page = await getCmsPage(handle);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">{page.title}</h1>
      <div
        // No @tailwindcss/typography plugin in this app — hand-rolled
        // element-selector overrides for whatever the admin's rich text
        // editor (apps/admin's RichTextEditor) can produce.
        className={
          'mt-6 max-w-none text-muted-foreground ' +
          '[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground ' +
          '[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-foreground ' +
          '[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 ' +
          '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic ' +
          '[&_a]:text-primary [&_a]:underline [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md'
        }
        dangerouslySetInnerHTML={{ __html: page.body }}
      />
    </div>
  );
}
