import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Activity,
  Gauge,
  KeyRound,
  LogOut,
  Server,
  ShieldCheck,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import type { View } from '../lib/contracts.js';
import { Button } from './ui/Button.js';

const navigation: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'servers', label: 'MCP Servers', icon: Server },
  { id: 'credentials', label: 'Credentials', icon: ShieldCheck },
  { id: 'keys', label: 'API Keys', icon: KeyRound },
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
];

export function AppShell({
  view,
  onViewChange,
  onLogout,
  children,
}: {
  view: View;
  onViewChange(view: View): void;
  onLogout(): void | Promise<void>;
  children: ReactNode;
}): ReactNode {
  return (
    <Tooltip.Provider delayDuration={350}>
      <div className="app-shell">
        <aside className="sidebar">
          <button className="brand" onClick={() => onViewChange('overview')} aria-label="MCP Home">
            <span className="brand-mark">
              <Waypoints size={20} strokeWidth={1.7} />
            </span>
            <span>
              <strong>MCP Home</strong>
              <small>Remote MCP control plane</small>
            </span>
          </button>
          <nav className="navigation" aria-label="主导航">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Tooltip.Root key={item.id}>
                  <Tooltip.Trigger asChild>
                    <button
                      className={cn('nav-item', view === item.id && 'nav-item-active')}
                      onClick={() => onViewChange(item.id)}
                      aria-label={item.label}
                      aria-current={view === item.id ? 'page' : undefined}
                    >
                      <Icon size={17} strokeWidth={1.8} />
                      <span>{item.label}</span>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="tooltip-content" side="right" sideOffset={9}>
                      {item.label}
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            })}
          </nav>
          <div className="sidebar-foot">
            <div className="local-state">
              <span />
              <div>
                <strong>Self-hosted</strong>
                <small>Single-user mode</small>
              </div>
            </div>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label="退出控制台"
                  onClick={() => void onLogout()}
                >
                  <LogOut size={17} strokeWidth={1.8} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="tooltip-content" side="right" sideOffset={9}>
                  退出控制台
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        </aside>
        <main className="workspace">{children}</main>
      </div>
    </Tooltip.Provider>
  );
}
