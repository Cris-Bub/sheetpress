import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/lib/types';

const styles: Record<InvoiceStatus, string> = {
  draft:    'bg-muted text-muted-foreground border border-border',
  sent:     'bg-[oklch(0.96_0.02_250)] text-[oklch(0.4_0.1_250)] border border-[oklch(0.88_0.04_250)] dark:bg-[oklch(0.3_0.05_250)] dark:text-[oklch(0.9_0.05_250)] dark:border-transparent',
  paid:     'bg-[oklch(0.96_0.05_145)] text-[oklch(0.4_0.13_145)] border border-[oklch(0.86_0.08_145)] dark:bg-[oklch(0.3_0.08_145)] dark:text-[oklch(0.9_0.08_145)] dark:border-transparent',
  partial:  'bg-[oklch(0.97_0.04_70)] text-[oklch(0.45_0.14_70)] border border-[oklch(0.88_0.07_70)] dark:bg-[oklch(0.3_0.07_70)] dark:text-[oklch(0.9_0.07_70)] dark:border-transparent',
  overdue:  'bg-[oklch(0.96_0.06_27)] text-[oklch(0.45_0.2_27)] border border-[oklch(0.88_0.08_27)] dark:bg-[oklch(0.3_0.1_27)] dark:text-[oklch(0.9_0.1_27)] dark:border-transparent',
  void:     'bg-muted text-muted-foreground border border-border line-through',
};

const labels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  void: 'Void',
};

export function StatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}
