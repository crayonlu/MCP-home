import { Menu } from '@base-ui/react'
import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

export interface MenuAction {
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

export function ActionsMenu({ actions }: { actions: MenuAction[] }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className="flex size-7 items-center justify-center rounded-none text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label="actions"
      >
        <MoreHorizontal className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} className="z-50">
          <Menu.Popup className="min-w-[160px] bg-surface py-1 shadow-xl shadow-black/20">
            {actions.map((action) => (
              <Menu.Item
                key={action.label}
                disabled={action.disabled}
                onSelect={action.onSelect}
                className={`flex h-9 cursor-pointer select-none items-center px-3 text-sm data-[highlighted]:bg-surface-2 ${
                  action.danger ? 'text-danger' : 'text-ink-2 data-[highlighted]:text-ink'
                } data-[disabled]:opacity-40`}
              >
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function ButtonMenu({
  trigger,
  actions,
}: {
  trigger: ReactNode
  actions: MenuAction[]
}) {
  return (
    <Menu.Root>
      <Menu.Trigger render={<button type="button" />} className="inline-flex">
        {trigger}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} className="z-50">
          <Menu.Popup className="min-w-[160px] bg-surface py-1 shadow-xl shadow-black/20">
            {actions.map((action) => (
              <Menu.Item
                key={action.label}
                disabled={action.disabled}
                onSelect={action.onSelect}
                className={`flex h-9 cursor-pointer select-none items-center px-3 text-sm data-[highlighted]:bg-surface-2 ${
                  action.danger ? 'text-danger' : 'text-ink-2 data-[highlighted]:text-ink'
                } data-[disabled]:opacity-40`}
              >
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
