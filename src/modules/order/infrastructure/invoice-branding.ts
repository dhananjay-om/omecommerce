import { getObjectBytes } from '../../../shared/infrastructure/storage/s3-client.js';

export interface InvoiceBranding {
  sellerName: string;
  sellerGstin: string | null;
  sellerAddress: string | null;
  /** "data:image/png;base64,...." — already embeddable directly as an <img src>, or null if there's no
   *  logo configured (or it failed to load) — the invoice template renders a logo-free header either way. */
  logoDataUri: string | null;
}

/** Guessed from the stored object key's extension — the upload flow only ever
 *  writes what the browser's <input type="file" accept="image/*"> produced,
 *  so this covers the realistic set without needing to store a separate
 *  content-type column just for this. Defaults to PNG (a safe embed
 *  regardless of the browser guessing wrong, since <img> sniffs anyway). */
function guessImageMimeType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

/**
 * Resolves everything the invoice template needs to know about the seller
 * for its letterhead — name/GSTIN/address are plain fields already on the
 * Website row, but the logo needs an extra network round-trip (fetching the
 * actual image bytes from S3/MinIO) since Puppeteer's PdfRenderer.render()
 * loads the HTML via page.setContent() with no base URL — an <img src="https://...">
 * pointing at storage would have no network path to resolve from inside that
 * page. A missing or unreadable logo (deleted object, transient S3 error)
 * never blocks invoice generation — it just renders without one.
 */
export async function resolveInvoiceBranding(website: {
  name: string;
  gstin: string | null;
  address: string | null;
  logoMediaKey: string | null;
}): Promise<InvoiceBranding> {
  let logoDataUri: string | null = null;
  if (website.logoMediaKey) {
    try {
      const bytes = await getObjectBytes(website.logoMediaKey);
      logoDataUri = `data:${guessImageMimeType(website.logoMediaKey)};base64,${bytes.toString('base64')}`;
    } catch {
      logoDataUri = null;
    }
  }
  return { sellerName: website.name, sellerGstin: website.gstin, sellerAddress: website.address, logoDataUri };
}
