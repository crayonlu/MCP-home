import { Badge } from '@cloudflare/kumo';
import { badgeVariant, runtimeTone } from '@/lib/format';
import { cn } from '@/lib/utils';

export function StatusLabel({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  return (
    <Badge
      appearance="dot"
      variant={badgeVariant(runtimeTone(status))}
      className={cn('text-xs', className)}
    >
      {status ?? 'unknown'}
    </Badge>
  );
}
