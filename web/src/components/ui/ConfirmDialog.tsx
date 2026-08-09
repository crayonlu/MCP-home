import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './Button.js';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm(): void | Promise<void>;
}): ReactNode {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const confirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="confirm-content">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          {error && <div className="inline-error">{error}</div>}
          <div className="dialog-actions">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={busy}>
                取消
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant="danger"
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  void confirm();
                }}
              >
                {busy ? '正在处理' : confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
