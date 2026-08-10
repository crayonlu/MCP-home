import {
  Database,
  FileText,
  Gauge,
  Gear,
  Key,
  PlugsConnected,
  Scroll,
  ShieldCheck,
  SignOut,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { DropdownMenu, Sidebar } from '@cloudflare/kumo';
import type { Route } from '@/lib/hooks';

const NAV: Array<{ id: Route; label: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <Gauge size={18} /> },
  { id: 'servers', label: 'Servers', icon: <Database size={18} /> },
  { id: 'credentials', label: 'Credentials', icon: <ShieldCheck size={18} /> },
  { id: 'keys', label: 'Keys', icon: <Key size={18} /> },
  { id: 'logs', label: 'Logs', icon: <Scroll size={18} /> },
];

export function AppShell({
  route,
  onNavigate,
  onLogout,
  children,
}: {
  route: Route;
  onNavigate(route: Route): void;
  onLogout(): void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <Sidebar.Provider contained defaultOpen collapsible="icon" className="h-screen">
      <Sidebar>
        <Sidebar.Header>
          <button
            onClick={() => onNavigate('overview')}
            className="flex items-center gap-2 px-2 py-1.5"
          >
            <PlugsConnected className="size-5 text-kumo-strong" />
            <span className="text-sm font-semibold text-kumo-strong">MCP Home</span>
          </button>
        </Sidebar.Header>

        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu>
              {NAV.map((item) => (
                <Sidebar.MenuButton
                  key={item.id}
                  icon={item.icon}
                  tooltip={item.label}
                  active={route === item.id}
                  href={`#/${item.id}`}
                />
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>

        <Sidebar.Footer>
          <DropdownMenu>
            <DropdownMenu.Trigger
              render={
                <Sidebar.MenuButton icon={<Gear size={18} />} tooltip="System">
                  System
                </Sidebar.MenuButton>
              }
            />
            <DropdownMenu.Content side="top" align="start">
              <DropdownMenu.LinkItem
                href="/api/v1/openapi.json"
                target="_blank"
                icon={<FileText size={16} />}
              >
                OpenAPI spec
              </DropdownMenu.LinkItem>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                variant="danger"
                icon={<SignOut size={16} />}
                onClick={() => void onLogout()}
              >
                退出登录
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
          <Sidebar.Trigger />
        </Sidebar.Footer>
      </Sidebar>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </Sidebar.Provider>
  );
}
