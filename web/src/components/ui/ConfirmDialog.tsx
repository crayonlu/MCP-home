import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Dialog } from './Dialog'
import { Button } from './Button'
import { useI18n } from '../../i18n'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(
  async () => false,
)

export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const settle = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && settle(false)}
        title={pending?.title ?? ''}
      >
        <div className="flex items-start gap-3">
          {pending?.danger && (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
          )}
          {pending?.description && (
            <p className="text-sm text-ink-2">{pending.description}</p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => settle(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={pending?.danger ? 'danger' : 'primary'}
            onClick={() => settle(true)}
          >
            {pending?.confirmLabel ?? t('common.confirm')}
          </Button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
