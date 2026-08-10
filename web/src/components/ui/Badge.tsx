import type { ReactNode } from 'react'

export type Tone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger'

const toneClass: Record<Tone, string> = {
  accent: 'bg-accent/15 text-accent',
  neutral: 'bg-surface-2 text-ink-2',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex h-5 shrink-0 items-center px-1.5 text-xs font-medium ${toneClass[tone]}`}>
      {children}
    </span>
  )
}

const dotClass: Record<Tone, string> = {
  accent: 'bg-accent',
  neutral: 'bg-ink-3',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

export function StatusDot({ tone = 'neutral', pulse }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center">
      <span
        className={`size-2 ${dotClass[tone]} ${pulse ? 'animate-pulse' : ''}`}
        aria-hidden
      />
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <div className="text-sm font-medium text-ink">{title}</div>
      {description && <div className="max-w-xs text-[13px] text-ink-3">{description}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
