import { redirect } from 'next/navigation';

/**
 * Superseded by the tabbed product detail page (admin UI revamp) — the
 * Overview tab at /products/[id] already has directly-editable fields, so
 * there's no longer a separate read-only "view" vs. editable "edit" page
 * the way the mock's own product detail never had that split either.
 * Kept as a redirect (not deleted outright) since existing bookmarks/links
 * to /products/[id]/edit should keep working.
 */
export default async function EditProductRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/products/${id}`);
}
