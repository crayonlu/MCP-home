import { Dialog } from '@base-ui/react'
import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useMediaQuery } from '../../app/useMediaQuery'

const motionSafe = 'motion-safe:transition-transform motion-safe:duration-200'

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  side,
  width = 440,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  footer?: ReactNode
  side?: 'right' | 'bottom'
  width?: number
}) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const resolvedSide = side ?? (isMobile ? 'bottom' : 'right')
  const bottom = resolvedSide === 'bottom'

  const positionClass = bottom
    ? `inset-x-0 bottom-0 max-h-[92dvh] translate-y-full data-[enter]:translate-y-0 data-[exit]:translate-y-full`
    : `right-0 top-0 h-dvh translate-x-full data-[enter]:translate-x-0 data-[exit]:translate-x-full`

  const sizeStyle: CSSProperties = bottom ? {} : { width: `min(100vw, ${width}px)` }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-150 data-[enter]:opacity-0 data-[enter]:opacity-100 data-[exit]:opacity-100 data-[exit]:opacity-0" />
        <Dialog.Popup
          className={`fixed z-50 flex flex-col bg-surface shadow-2xl shadow-black/50 ${positionClass} ${motionSafe}`}
          style={sizeStyle}
        >
          {bottom && <div className="mx-auto mt-2 h-1 w-10 shrink-0 bg-ink-3/50" />}
          <div className="flex h-12 shrink-0 items-center justify-between px-4">
            <Dialog.Title className="text-[15px] font-semibold tracking-[-0.01em]">
              {title}
            </Dialog.Title>
            <Dialog.Close
              className="flex size-7 items-center justify-center text-ink-3 transition-colors hover:text-ink"
              aria-label="close"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-ink-3/10 px-4 py-3">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
