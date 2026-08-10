import { ClipboardText } from '@cloudflare/kumo';

export function CopyField({ value, className }: { value: string; className?: string }) {
  return <ClipboardText text={value} size="sm" className={className} />;
}
