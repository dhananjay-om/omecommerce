/** A row of small thumbnails for a customer's own uploaded review photos —
 *  each opens the full-size image in a new tab (no extra lightbox
 *  component; the presigned URL is already a direct, shareable image
 *  link). Renders nothing when a review has no images. */
export function ReviewImages({ images }: { images: string[] }) {
  if (images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {images.map((url, i) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic; next/image's remote-pattern allowlist doesn't fit this */}
          <img src={url} alt={`Review photo ${i + 1}`} className="size-16 rounded-md border object-cover" />
        </a>
      ))}
    </div>
  );
}
