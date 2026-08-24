/**
 * Named format kinds, not a passed-in function — both chart components are
 * Client Components, and a Server Component caller (every /reports/*
 * page.tsx) can't pass a function prop across that boundary (Next.js RSC
 * constraint: "Functions cannot be passed directly to Client Components").
 * Pick a kind here instead; the chart resolves it to a real formatter
 * client-side.
 */
export type ChartValueFormat = 'plain' | 'compact' | 'money';

export function resolveChartFormatter(format: ChartValueFormat = 'plain'): (v: number) => string {
  switch (format) {
    case 'compact':
      return (v: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
    case 'money':
      return (v: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    case 'plain':
    default:
      return (v: number) => v.toLocaleString('en-US');
  }
}
