import type { ReactNode } from 'react';
import { Empty } from '@cloudflare/kumo';

export function EmptyState({
  title,
  description,
  contents,
  className,
}: {
  title: string;
  description?: string;
  contents?: ReactNode;
  className?: string;
}) {
  return (
    <Empty
      size="sm"
      title={title}
      {...(description ? { description } : {})}
      {...(contents ? { contents } : {})}
      className={className}
    />
  );
}
