'use client';

import { cn } from '@/lib/utils';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Twelve tiny vertical bars, one per month. Height is proportional to that month's value.
 * Visual cadence for the year — see your rhythm without thinking.
 */
export function SparkBars({
  values,
  highlightIndex,
  className,
  height = 36,
  titles,
}: {
  values: number[];
  highlightIndex?: number;
  className?: string;
  height?: number;
  /** Optional tooltip per bar (e.g. pre-formatted money strings). */
  titles?: string[];
}) {
  const max = Math.max(1, ...values);
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-end gap-0.5" style={{ height }}>
        {values.map((v, i) => {
          const h = Math.max(2, (v / max) * height);
          const highlighted = highlightIndex === i;
          return (
            <div
              key={i}
              className={cn(
                'flex-1 rounded-sm transition-colors',
                v === 0 && 'bg-muted',
                v > 0 && !highlighted && 'bg-foreground/30',
                highlighted && 'bg-foreground',
              )}
              style={{ height: h }}
              title={titles?.[i] ?? String(v)}
            />
          );
        })}
      </div>
      <div className="flex gap-0.5 text-[9px] text-muted-foreground/70 tabular-nums">
        {MONTHS.map((m, i) => (
          <div key={i} className="flex-1 text-center">{m}</div>
        ))}
      </div>
    </div>
  );
}
