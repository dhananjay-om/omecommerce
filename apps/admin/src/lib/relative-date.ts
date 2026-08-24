/** "Today" / "3 days ago" / "1w ago" — matches the mock's relative-date
 *  columns exactly, instead of a fixed-format absolute date. Shared across
 *  every list table's date column (Orders, Products, …). */
export function relativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString('en-US');
}
