import {
  Gauge,
  KeyRound,
  LogOut,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Route } from '@/lib/hooks';

const NAV: Array<{ id: Route; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'servers', label: 'Servers', icon: Server },
  { id: 'credentials', label: 'Credentials', icon: ShieldCheck },
  { id: 'keys', label: 'Keys', icon: KeyRound },
  { id: 'logs', label: 'Logs', icon: ScrollText },
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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3 lg:w-56 lg:items-stretch lg:px-3">
        <button
          onClick={() => onNavigate('overview')}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 lg:px-3"
        >
          <Waypoints className="size-5 shrink-0 text-foreground" strokeWidth={1.7} />
          <span className="hidden text-sm font-semibold lg:inline">MCP Home</span>
        </button>

        <nav className="mt-2 flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = route === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors lg:justify-start lg:px-3',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.8} />
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center justify-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground lg:justify-start lg:px-3"
              aria-label="System"
            >
              <Settings className="size-4 shrink-0" strokeWidth={1.8} />
              <span className="hidden lg:inline">System</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="mb-1 w-48">
            <DropdownMenuItem asChild>
              <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">
                OpenAPI spec
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void onLogout()} className="text-red-400 focus:text-red-300">
              <LogOut className="size-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
