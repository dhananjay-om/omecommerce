import { presignGetUrl } from '../../../shared/infrastructure/storage/s3-client.js';

/**
 * The rich-text editor (apps/admin's RichTextEditor) can embed images
 * inline in a Page/Block's HTML body. Those images live in S3 behind the
 * same presigned-GET pattern as every other image in this app (Category/
 * Banner/Website — never a public bucket), which means the URL baked into
 * `<img src>` at upload time would go stale after 15 minutes if it were
 * saved verbatim. Instead, the editor tags each inserted image with a
 * stable `data-media-key` attribute holding the real S3 key, and this
 * function — run server-side, once per read, right before the view is
 * handed to either the admin or the storefront — resolves each one to a
 * *fresh* presigned URL. Same "resolve live, never persist the URL itself"
 * principle as toCategoryView/toBannerView's imageUrl, just applied inside
 * a blob of HTML instead of to a single dedicated column.
 *
 * Regex-based, not a full HTML parser — acceptable here because this app
 * fully controls the exact tag shape it ever emits (`<img ...
 * data-media-key="key" ... src="...">`); this isn't parsing arbitrary
 * third-party markup.
 */
const IMG_WITH_MEDIA_KEY_RE = /<img\b[^>]*\bdata-media-key="([^"]+)"[^>]*>/g;

export async function resolveInlineImages(body: string): Promise<string> {
  const matches = [...body.matchAll(IMG_WITH_MEDIA_KEY_RE)];
  if (matches.length === 0) return body;

  const keys = [...new Set(matches.map((m) => m[1]!))];
  const entries = await Promise.all(keys.map(async (key) => [key, await presignGetUrl(key)] as const));
  const urlByKey = new Map(entries);

  return body.replace(IMG_WITH_MEDIA_KEY_RE, (tag, key: string) => {
    const freshUrl = urlByKey.get(key);
    if (!freshUrl) return tag;
    return /\ssrc="[^"]*"/.test(tag) ? tag.replace(/\ssrc="[^"]*"/, ` src="${freshUrl}"`) : tag.replace('<img', `<img src="${freshUrl}"`);
  });
}
