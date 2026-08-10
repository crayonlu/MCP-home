import { ClipboardText, Dialog } from '@cloudflare/kumo';
import { ShieldWarningIcon } from '@phosphor-icons/react';

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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="p-6">
        <div className="mb-3 flex items-center gap-2">
          <ShieldWarningIcon className="size-5 text-kumo-warning" />
          <Dialog.Title className="text-base font-semibold">{label} 已创建</Dialog.Title>
        </div>
        <Dialog.Description className="text-kumo-subtle">
          此密钥仅显示一次,关闭后无法再次查看。请立即复制并妥善保存。
        </Dialog.Description>
        {secret && (
          <div className="mt-4">
            <ClipboardText text={secret} size="sm" />
          </div>
        )}
      </Dialog>
    </Dialog.Root>
  );
}
