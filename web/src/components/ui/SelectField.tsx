import { Select } from '@base-ui/react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-[13px] font-medium text-ink-2">{label}</span>}
      <Select.Root
        value={value}
        onValueChange={(next) => onChange(next ?? value)}
        itemToStringLabel={(item) => {
          const option = options.find((candidate) => candidate.value === item)
          return option?.label ?? String(item)
        }}
      >
        <Select.Trigger className="flex h-9 w-full select-none items-center justify-between bg-surface-2 px-3 text-sm text-ink data-[popup-open]:ring-2 data-[popup-open]:ring-accent/50">
          <Select.Value>
            {options.find((option) => option.value === value)?.label ??
              (value === '' ? ' ' : String(value))}
          </Select.Value>
          <Select.Icon>
            <ChevronDown className="size-4 text-ink-3" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={4} className="z-50">
            <Select.Popup className="min-w-[var(--anchor-width)] bg-surface py-1 shadow-xl shadow-black/20">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="flex h-9 cursor-pointer select-none items-center px-3 text-sm text-ink-2 data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink data-[selected]:text-accent"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}
