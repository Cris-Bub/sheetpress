'use client';

import type { InvoiceStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

// Hue per status. Kept muted to feel like ink, not dashboard candy.
const COLORS: Record<InvoiceStatus, string> = {
  paid:    'bg-[oklch(0.66_0.11_145)]',
  partial: 'bg-[oklch(0.72_0.13_70)]',
  sent:    'bg-[oklch(0.7_0.08_250)]',
  overdue: 'bg-[oklch(0.62_0.18_27)]',
  draft:   'bg-[oklch(0.85_0.005_80)]',
  void:    'bg-transparent',
};

export type Segment = {
  key: InvoiceStatus;
  label: string;
  value: number;
};

/**
 * Horizontal stacked bar. Each segment's width is proportional to its value.
 * Use to give "see it" comprehension to a multi-status total.
 */
export function ProportionBar({
  segments,
  height = 8,
  className,
}: {
  segments: Segment[];
  height?: number;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div
        className={cn('w-full rounded-full bg-muted', className)}
        style={{ height }}
      />
    );
  }
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-muted flex gap-px',
        className,
      )}
      style={{ height }}
    >
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div
            key={s.key}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', COLORS[s.key])}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${Math.round((s.value / total) * 100)}%`}
          />
        ))}
    </div>
  );
}

/**
 * A simple progress bar (paid/owed). Used inside invoice rows for partials.
 */
export function ProgressBar({
  ratio,
  className,
  height = 4,
}: {
  ratio: number;
  className?: string;
  height?: number;
}) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-muted', className)}
      style={{ height }}
    >
      <div
        className="h-full bg-[oklch(0.66_0.11_145)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Tiny status legend dot.
 */
export function LegendDot({ status }: { status: InvoiceStatus }) {
  return <span className={cn('inline-block size-2 rounded-full', COLORS[status])} />;
}
