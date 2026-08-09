import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  value,
  options,
  onValueChange,
  hint,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onValueChange(value: string): void;
  hint?: string;
}): ReactNode {
  return (
    <label className="field">
      <span>{label}</span>
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger className="select-trigger">
          <Select.Value />
          <Select.Icon>
            <ChevronDown size={15} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="select-content" position="popper" sideOffset={5}>
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item className="select-item" value={option.value} key={option.value}>
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {hint && <small>{hint}</small>}
    </label>
  );
}
