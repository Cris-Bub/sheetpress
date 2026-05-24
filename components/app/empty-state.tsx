import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={'rounded-lg border border-dashed border-border py-16 text-center px-6 ' + (className ?? '')}>
      <h2 className="font-serif text-xl tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      ) : null}
      {action ? <div className="mt-5 inline-flex">{action}</div> : null}
    </div>
  );
}
