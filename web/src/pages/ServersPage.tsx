import {
  ArrowClockwise,
  Database,
  DotsThreeVertical,
  MagnifyingGlass,
  PencilSimple,
  Play,
  Plus,
  Power,
  Trash,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DropdownMenu,
  Input,
  Table,
} from '@cloudflare/kumo';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusLabel } from '@/components/shared/StatusDot';
import { api, apiVoid, errorMessage } from '@/lib/api';
import {
  credentialRecordSchema,
  serverRecordSchema,
  serverStatusSchema,
  type ServerRecord,
  type ServerStatus,
} from '@/lib/contracts';
import { useResource, useToast } from '@/lib/hooks';
import { relativeDate } from '@/lib/format';
import { ServerFormDialog } from './server-form';
import { ServerInspect } from './server-inspect';

export function ServersPage() {
  const servers = useResource('/api/v1/servers', serverRecordSchema.array());
  const creds = useResource('/api/v1/credentials', credentialRecordSchema.array());
  const [statuses, setStatuses] = useState<Record<string, ServerStatus | null>>({});
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ServerRecord | null | 'new'>(null);
  const [inspecting, setInspecting] = useState<ServerStatus | null>(null);
  const [deleting, setDeleting] = useState<ServerRecord | null>(null);
  const toast = useToast();

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
      toast.error(`${server.name} 操作失败`, errorMessage(cause));
    }
  };

  const filtered = servers.data?.filter((s) =>
    query ? (s.name + s.slug).toLowerCase().includes(query.toLowerCase()) : true,
  );

  return (
    <>
      <PageHeader title="Servers">
        <Input
          aria-label="搜索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索"
          size="xs"
          className="w-40"
        />
        <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
          <Plus size={16} /> 添加
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-4">
        {servers.error ? (
          <div className="text-sm text-kumo-danger">{servers.error}</div>
        ) : servers.loading && !servers.data ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-kumo-tint" />
            ))}
          </div>
        ) : !filtered || filtered.length === 0 ? (
          <EmptyState
            title={query ? '无匹配结果' : '还没有 MCP Server'}
            description={query ? '' : '添加一个 Remote-native 或 Home-hosted Server。'}
            contents={
              !query && (
                <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
                  <Plus size={16} /> 添加 Server
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-kumo-line">
            <Table>
              <Table.Header variant="compact">
                <Table.Row>
                  <Table.Head />
                  <Table.Head>Server</Table.Head>
                  <Table.Head>Runtime</Table.Head>
                  <Table.Head>Endpoint</Table.Head>
                  <Table.Head />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filtered.map((s) => {
                  const st = statuses[s.id]?.runtime ?? null;
                  const status = st?.status ?? (s.enabled ? 'unknown' : 'disabled');
                  return (
                    <Table.Row key={s.id}>
                      <Table.Cell>
                        <Database size={16} className="text-kumo-subtle" />
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.name}</span>
                          <Badge variant="neutral" className="font-mono text-[10px]">
                            {s.slug}
                          </Badge>
                          {!s.enabled && <Badge variant="neutral">停用</Badge>}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-2 text-xs text-kumo-subtle">
                          <StatusLabel status={status} />
                          {st?.lastSuccessAt && <span>{relativeDate(st.lastSuccessAt)}</span>}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <code className="font-mono text-xs text-kumo-subtle">/mcp/{s.slug}</code>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <DropdownMenu>
                          <DropdownMenu.Trigger
                            render={
                              <Button
                                variant="ghost"
                                shape="square"
                                size="xs"
                                icon={<DotsThreeVertical size={16} />}
                                aria-label="操作"
                              />
                            }
                          />
                          <DropdownMenu.Content align="end">
                            <DropdownMenu.Item
                              icon={<MagnifyingGlass size={16} />}
                              onClick={() => {
                                const detail = statuses[s.id];
                                if (detail) setInspecting(detail);
                              }}
                            >
                              详情
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              icon={<PencilSimple size={16} />}
                              onClick={() => setEditing(s)}
                            >
                              编辑
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item
                              icon={<Play size={16} />}
                              onClick={() => void runAction(s, 'test', '已测试')}
                            >
                              测试连接
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              icon={<ArrowClockwise size={16} />}
                              onClick={() => void runAction(s, 'refresh', '已刷新')}
                            >
                              刷新能力
                            </DropdownMenu.Item>
                            {s.kind === 'home' && (
                              <DropdownMenu.Item
                                icon={<ArrowClockwise size={16} />}
                                onClick={() => void runAction(s, 'restart', '已重启')}
                              >
                                重启进程
                              </DropdownMenu.Item>
                            )}
                            <DropdownMenu.Item
                              icon={<Power size={16} />}
                              onClick={() =>
                                void runAction(s, s.enabled ? 'disable' : 'enable', s.enabled ? '已停用' : '已启用')
                              }
                            >
                              {s.enabled ? '停用' : '启用'}
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item
                              variant="danger"
                              icon={<Trash size={16} />}
                              onClick={() => setDeleting(s)}
                            >
                              删除
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </div>
        )}
      </div>

      <ServerFormDialog
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

      <Dialog.Root open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <Dialog size="sm" className="p-6">
          <Dialog.Title className="text-base font-semibold">删除 {deleting?.name}?</Dialog.Title>
          <Dialog.Description className="text-kumo-subtle">
            配置、能力快照与运行日志将被删除,上游服务本身不受影响。
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close render={<Button variant="secondary" size="sm">取消</Button>} />
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await apiVoid(`/api/v1/servers/${deleting.id}`, { method: 'DELETE' });
                  toast.success(`${deleting.name} 已删除`);
                  setDeleting(null);
                  reload();
                } catch (cause) {
                  toast.error('删除失败', errorMessage(cause));
                }
              }}
            >
              删除
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}
