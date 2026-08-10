import { Field } from '@base-ui/react'
import type { ReactNode } from 'react'

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
  mono,
  autoFocus,
  disabled,
  className = '',
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  mono?: boolean
  autoFocus?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <Field.Root className={`flex flex-col gap-1.5 ${className}`}>
      {label && <Field.Label className="text-[13px] font-medium text-ink-2">{label}</Field.Label>}
      <Field.Control
        type={type}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        spellCheck={false}
        className={`h-9 w-full bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 ${mono ? 'font-mono' : ''}`}
      />
    </Field.Root>
  )
}

export function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  mono,
  className = '',
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  mono?: boolean
  className?: string
}) {
  return (
    <Field.Root className={`flex flex-col gap-1.5 ${className}`}>
      {label && <Field.Label className="text-[13px] font-medium text-ink-2">{label}</Field.Label>}
      <Field.Control
        render={<textarea rows={rows} />}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        spellCheck={false}
        className={`w-full resize-y bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/50 ${mono ? 'font-mono' : ''}`}
      />
    </Field.Root>
  )
}

export function FieldGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-4 ${className}`}>{children}</div>
}
