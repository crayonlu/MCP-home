import * as Switch from '@radix-ui/react-switch';
import type { ReactNode } from 'react';

export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange(checked: boolean): void;
}): ReactNode {
  return (
    <div className="switch-field">
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <Switch.Root className="switch-root" checked={checked} onCheckedChange={onCheckedChange}>
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
    </div>
  );
}
