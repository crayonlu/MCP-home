import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastValue>({ toast: () => {} })

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++
      setItems((current) => [...current, { id, kind, message }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex flex-col items-center gap-2 px-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="glass-strong pointer-events-auto flex w-full max-w-sm items-start gap-2.5 px-3.5 py-2.5 shadow-xl shadow-black/20 motion-safe:animate-in"
          >
            {item.kind === 'success' && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
            {item.kind === 'error' && <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
            {item.kind === 'info' && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />}
            <span className="min-w-0 flex-1 text-sm text-ink">{item.message}</span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="text-ink-3 transition-colors hover:text-ink"
              aria-label="dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
