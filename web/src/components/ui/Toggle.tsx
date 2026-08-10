import { Switch } from '@base-ui/react'

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="relative inline-flex h-5 w-9 shrink-0 items-center bg-surface-2 data-[checked]:bg-accent"
      >
        <Switch.Thumb className="block size-4 bg-ink shadow-sm transition-transform duration-150 data-[checked]:translate-x-[18px] data-[unchecked]:translate-x-[2px]" />
      </Switch.Root>
      {label && <span className="text-sm text-ink-2">{label}</span>}
    </div>
  )
}
