import { Tabs } from '@base-ui/react'
import type { ReactNode } from 'react'

export interface TabItem {
  value: string
  label: string
}

export function TabsView({
  tabs,
  value,
  onChange,
  render,
  className = '',
}: {
  tabs: TabItem[]
  value: string
  onChange: (value: string) => void
  render: (value: string) => ReactNode
  className?: string
}) {
  return (
    <Tabs.Root value={value} onValueChange={(next) => next && onChange(next)}>
      <Tabs.List className={`flex gap-6 ${className}`}>
        {tabs.map((tab) => (
          <Tabs.Tab
            key={tab.value}
            value={tab.value}
            className="relative h-10 text-sm text-ink-3 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-transparent after:content-[''] hover:text-ink-2 data-[selected]:text-ink data-[selected]:after:bg-accent"
          >
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Panel
          key={tab.value}
          value={tab.value}
          className={value === tab.value ? 'pt-4' : 'hidden'}
        >
          {render(tab.value)}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}
