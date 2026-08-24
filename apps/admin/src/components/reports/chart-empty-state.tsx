/** Shared "nothing in this range" state — a blank chart reads as broken;
 *  this reads as "correctly, there's no data yet." */
export function ChartEmptyState({ message = 'No data in this date range.' }: { message?: string }) {
  return <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">{message}</div>;
}
