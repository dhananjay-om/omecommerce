import Link from 'next/link';

const TONE_CLASS: Record<string, { text: string; bar: string }> = {
  accent: { text: 'text-primary', bar: 'bg-primary' },
  warning: { text: 'text-status-warning', bar: 'bg-status-warning' },
  critical: { text: 'text-status-critical', bar: 'bg-status-critical' },
  good: { text: 'text-status-good', bar: 'bg-status-good' },
  serious: { text: 'text-status-serious', bar: 'bg-status-serious' },
};

/** One "Real-Time Operations" tile — a big colored count, a label, and a
 *  thin colored underline bar, matching the mock's `.ops-tile` exactly.
 *  Links to the Orders (or Inventory) list pre-filtered to the same rows
 *  the count represents, so the number is always one click from the real
 *  list behind it, not just a static figure. */
export function OpsTile({ value, label, tone, href }: { value: number; label: string; tone: keyof typeof TONE_CLASS; href: string }) {
  const c = TONE_CLASS[tone];
  return (
    <Link href={href} className="block rounded-lg border p-3 transition-colors hover:bg-muted/50">
      <div className={`text-2xl font-bold tabular-nums ${c.text}`}>{value.toLocaleString('en-US')}</div>
      <div className="mt-0.5 text-xs font-medium text-muted-foreground uppercase">{label}</div>
      <div className={`mt-2 h-1.5 rounded-full ${c.bar} opacity-55`} />
    </Link>
  );
}
