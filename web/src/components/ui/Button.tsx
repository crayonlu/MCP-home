import { Button as BaseButton } from '@base-ui/react'
import type { ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:brightness-110',
  secondary: 'bg-surface-2 text-ink hover:brightness-110',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-110',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-4 text-sm',
}

export interface ButtonProps {
  children?: ReactNode
  onClick?: (event: React.MouseEvent) => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled,
  loading,
  type = 'button',
  className = '',
  title,
}: ButtonProps) {
  return (
    <BaseButton
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`inline-flex shrink-0 select-none items-center justify-center gap-1.5 font-medium transition-all duration-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </BaseButton>
  )
}

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  )
}
