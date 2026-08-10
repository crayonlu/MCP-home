import { cn } from '@/lib/utils';
import { runtimeTone, toneDot, type Tone } from '@/lib/format';

export function StatusDot({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        toneDot(runtimeTone(status)),
        className,
      )}
    />
  );
}

export function StatusLabel({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const tone: Tone = runtimeTone(status);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', className)}>
      <StatusDot status={status} />
      <span className={tone === 'ready' ? 'text-emerald-400' : tone === 'pending' ? 'text-amber-400' : tone === 'error' ? 'text-red-400' : 'text-zinc-500'}>
        {status ?? 'unknown'}
      </span>
    </span>
  );
}
