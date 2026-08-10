import { Dialog as BaseDialog } from '@base-ui/react'
import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  width = 480,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-150 data-[enter]:opacity-0 data-[enter]:opacity-100 data-[exit]:opacity-100 data-[exit]:opacity-0" />
        <BaseDialog.Popup
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,var(--width))] -translate-x-1/2 -translate-y-1/2 bg-surface p-5 shadow-2xl shadow-black/50 transition-[opacity,transform] duration-150 data-[enter]:scale-95 data-[enter]:opacity-0 data-[enter]:scale-100 data-[enter]:opacity-100 data-[exit]:scale-95 data-[exit]:opacity-0"
          style={{ '--width': `${width}px` } as CSSProperties}
        >
          <div className="mb-4 flex items-center justify-between">
            <BaseDialog.Title className="text-base font-semibold tracking-[-0.01em]">
              {title}
            </BaseDialog.Title>
            <BaseDialog.Close
              className="flex size-7 items-center justify-center text-ink-3 transition-colors hover:text-ink"
              aria-label="close"
            >
              <X className="size-4" />
            </BaseDialog.Close>
          </div>
          <div className="max-h-[70dvh] overflow-y-auto">{children}</div>
          {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
