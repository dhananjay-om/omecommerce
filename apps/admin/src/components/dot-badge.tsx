import type { VariantProps } from 'class-variance-authority';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** A status pill with a leading colored dot — matches the mock's `.badge`
 *  exactly (the existing `Badge` variants already give the tinted bg +
 *  colored text; the dot is the one piece this adds). Shared across every
 *  list table's Status column (Orders, Products, …). */
export function DotBadge({ variant, children }: { variant: VariantProps<typeof badgeVariants>['variant']; children: React.ReactNode }) {
  const dotColor: Record<string, string> = {
    success: 'bg-status-good',
    warning: 'bg-status-warning',
    destructive: 'bg-status-critical',
    secondary: 'bg-muted-foreground',
    outline: 'bg-muted-foreground',
    ghost: 'bg-muted-foreground',
    link: 'bg-primary',
    default: 'bg-primary',
  };
  return (
    <Badge variant={variant}>
      <span className={cn('size-1.5 rounded-full', dotColor[variant ?? 'default'])} />
      {children}
    </Badge>
  );
}
