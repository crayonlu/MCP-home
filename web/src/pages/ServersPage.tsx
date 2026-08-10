import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  FileSearch,
  Globe2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  TerminalSquare,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusDot } from '@/components/shared/StatusDot';
import { api, apiVoid, errorMessage } from '@/lib/api';
import {
  credentialRecordSchema,
  serverRecordSchema,
  serverStatusSchema,
  type ServerRecord,
  type ServerStatus,
} from '@/lib/contracts';
import { useResource } from '@/lib/hooks';
import { relativeDate } from '@/lib/format';
import { ServerFormSheet } from './server-form';
import { ServerInspect } from './server-inspect';

export function ServersPage() {
  const servers = useResource('/api/v1/servers', serverRecordSchema.array());
  const creds = useResource('/api/v1/credentials', credentialRecordSchema.array());
  const [statuses, setStatuses] = useState<Record<string, ServerStatus | null>>({});
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ServerRecord | null | 'new'>(null);
  const [inspecting, setInspecting] = useState<ServerStatus | null>(null);
  const [deleting, setDeleting] = useState<ServerRecord | null>(null);

  const loadStatuses = useCallback(async (list: ServerRecord[]) => {
    const entries = await Promise.all(
      list.map(async (s): Promise<[string, ServerStatus | null]> => {
        try {
          return [s.id, await api(`/api/v1/servers/${s.id}/status`, serverStatusSchema)];
        } catch {
          return [s.id, null];
        }
      }),
    );
    setStatuses(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    if (servers.data) void loadStatuses(servers.data);
  }, [servers.data, loadStatuses]);

  const reload = () => {
    servers.reload();
    creds.reload();
  };

  const runAction = async (server: ServerRecord, action: string, label: string) => {
    try {
      await apiVoid(`/api/v1/servers/${server.id}/${action}`, { method: 'POST' });
      toast.success(`${server.name} · ${label}`);
      reload();
    } catch (cause) {
      toast.error(`${server.name} 操作失败`, { description: errorMessage(cause) });
    }
  };

  const filtered = servers.data?.filter((s) =>
    query ? (s.name + s.slug).toLowerCase().includes(query.toLowerCase()) : true,
  );

  return (
    <>
      <PageHeader title="Servers">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索"
            className="h-8 w-40 pl-7 text-xs"
          />
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="size-4" />
          添加
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6">
        {servers.error ? (
          <div className="text-sm text-red-400">{servers.error}</div>
        ) : servers.loading && !servers.data ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !filtered || filtered.length === 0 ? (
          <EmptyState
            title={query ? '无匹配结果' : '还没有 MCP Server'}
            hint={query ? '' : '添加一个 Remote-native 或 Home-hosted Server。'}
            action={
              !query && (
                <Button size="sm" onClick={() => setEditing('new')}>
                  <Plus className="size-4" /> 添加 Server
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="w-6 px-4 py-2" />
                  <th className="px-4 py-2 font-medium">Server</th>
                  <th className="px-4 py-2 font-medium">Runtime</th>
                  <th className="px-4 py-2 font-medium">Endpoint</th>
                  <th className="w-8 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => {
                  const st = statuses[s.id]?.runtime ?? null;
                  const status = st?.status ?? (s.enabled ? 'unknown' : 'disabled');
                  return (
                    <tr key={s.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5"><StatusDot status={status} /></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {s.kind === 'remote' ? (
                            <Globe2 className="size-3.5 text-muted-foreground" />
                          ) : (
                            <TerminalSquare className="size-3.5 text-muted-foreground" />
                          )}
                          <span className="font-medium">{s.name}</span>
                          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                            {s.slug}
                          </Badge>
                          {!s.enabled && (
                            <Badge variant="outline" className="text-[10px] text-zinc-500">停用</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        <span>{status}</span>
                        {st?.lastSuccessAt && <span className="ml-2">{relativeDate(st.lastSuccessAt)}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-xs text-muted-foreground">/mcp/{s.slug}</code>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-xs" aria-label="操作">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onSelect={() => {
                                const detail = statuses[s.id];
                                if (detail) setInspecting(detail);
                              }}
                            >
                              <FileSearch className="size-4" /> 详情
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setEditing(s)}>
                              <Pencil className="size-4" /> 编辑
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => void runAction(s, 'test', '已测试')}>
                              <Play className="size-4" /> 测试连接
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void runAction(s, 'refresh', '已刷新')}>
                              <RefreshCw className="size-4" /> 刷新能力
                            </DropdownMenuItem>
                            {s.kind === 'home' && (
                              <DropdownMenuItem onSelect={() => void runAction(s, 'restart', '已重启')}>
                                <RotateCcw className="size-4" /> 重启进程
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onSelect={() => void runAction(s, s.enabled ? 'disable' : 'enable', s.enabled ? '已停用' : '已启用')}
                            >
                              <Power className="size-4" /> {s.enabled ? '停用' : '启用'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-300"
                              onSelect={() => setDeleting(s)}
                            >
                              <Trash2 className="size-4" /> 删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ServerFormSheet
        key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
        open={editing !== null}
        server={editing === 'new' ? null : editing}
        credentials={creds.data ?? []}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={async (server) => {
          setEditing(null);
          toast.success(`${server.name} 已保存`);
          reload();
        }}
      />

      <ServerInspect status={inspecting} onOpenChange={(o) => !o && setInspecting(null)} />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              配置、能力快照与运行日志将被删除,上游服务本身不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await apiVoid(`/api/v1/servers/${deleting.id}`, { method: 'DELETE' });
                  toast.success(`${deleting.name} 已删除`);
                  setDeleting(null);
                  reload();
                } catch (cause) {
                  toast.error('删除失败', { description: errorMessage(cause) });
                }
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
