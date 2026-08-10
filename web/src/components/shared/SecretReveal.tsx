import { ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CopyButton } from '@/components/shared/CopyButton';

export function SecretReveal({
  open,
  onOpenChange,
  secret,
  label = 'Access Key',
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  secret: string | null;
  label?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-amber-400" />
            {label} 已创建
          </DialogTitle>
          <DialogDescription>
            此密钥仅显示一次,关闭后无法再次查看。请立即复制并妥善保存。
          </DialogDescription>
        </DialogHeader>
        {secret && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
            <code className="flex-1 break-all font-mono text-xs text-foreground">{secret}</code>
            <CopyButton value={secret} label="复制" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
