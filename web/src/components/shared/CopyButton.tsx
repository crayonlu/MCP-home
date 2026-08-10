import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement('textarea');
      el.value = value;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
    }
    setDone(true);
    toast.success('已复制');
    window.setTimeout(() => setDone(false), 1400);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={onCopy}
      className={cn('font-mono', className)}
    >
      {done ? <Check className="size-3" /> : <Copy className="size-3" />}
      {label}
    </Button>
  );
}
