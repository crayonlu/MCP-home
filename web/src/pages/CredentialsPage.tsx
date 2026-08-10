import {
  ArrowClockwise,
  DotsThreeVertical,
  Key,
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DropdownMenu,
  Table,
} from '@cloudflare/kumo';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusLabel } from '@/components/shared/StatusDot';
import { api, apiVoid, errorMessage } from '@/lib/api';
import {
  authorizationResultSchema,
  credentialRecordSchema,
  type CredentialRecord,
} from '@/lib/contracts';
import { useResource, useToast } from '@/lib/hooks';
import { relativeDate } from '@/lib/format';
import { CredentialFormDialog } from './credential-form';

const testSchema = z.object({ valid: z.boolean() }).passthrough();

export function CredentialsPage() {
  const list = useResource('/api/v1/credentials', credentialRecordSchema.array());
  const [editing, setEditing] = useState<CredentialRecord | null | 'new'>(null);
  const [deleting, setDeleting] = useState<CredentialRecord | null>(null);
  const toast = useToast();
  const pollRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  const reload = list.reload;

  const pollUntilSettled = useCallback(
    (id: string) => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      let ticks = 0;
      pollRef.current = window.setInterval(async () => {
        ticks += 1;
        try {
          const c = await api(`/api/v1/credentials/${id}`, credentialRecordSchema);
          if (c.status !== 'pending' || ticks > 40) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
            reload();
            toast.success(`${c.name} · ${c.status}`);
          }
        } catch {
          /* keep polling */
        }
      }, 2500);
    },
    [reload, toast],
  );

  const authorize = async (c: CredentialRecord) => {
    try {
      const res = await api(`/api/v1/credentials/${c.id}/authorize`, authorizationResultSchema, {
        method: 'POST',
      });
      if (res.status === 'authorization-required' && res.authorizationUrl) {
        window.open(res.authorizationUrl, '_blank', 'noopener,width=520,height=680');
        toast.message(`${c.name} · 请在弹窗中完成授权`);
        pollUntilSettled(c.id);
      } else {
        toast.success(`${c.name} · 已授权`);
        reload();
      }
    } catch (cause) {
      toast.error('授权失败', errorMessage(cause));
    }
  };

  const test = async (c: CredentialRecord) => {
    try {
      const res = await api(`/api/v1/credentials/${c.id}/test`, testSchema, { method: 'POST' });
      if (res.valid) toast.success(`${c.name} · 验证通过`);
      else toast.error(`${c.name} · 验证失败`);
    } catch (cause) {
      toast.error(`${c.name} 验证失败`, errorMessage(cause));
    }
  };

  return (
    <>
      <PageHeader title="Credentials">
        <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
          <Plus size={16} /> 添加
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-4">
        {list.error ? (
          <div className="text-sm text-kumo-danger">{list.error}</div>
        ) : list.loading && !list.data ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-kumo-tint" />
            ))}
          </div>
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState
            title="还没有 Credential"
            description="为上游 MCP Server 创建 Bearer / API Key / OAuth 凭据。"
            contents={
              <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
                <Plus size={16} /> 添加 Credential
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-kumo-line">
            <Table>
              <Table.Header variant="compact">
                <Table.Row>
                  <Table.Head />
                  <Table.Head>名称</Table.Head>
                  <Table.Head>类型</Table.Head>
                  <Table.Head>状态</Table.Head>
                  <Table.Head>过期</Table.Head>
                  <Table.Head />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {list.data.map((c) => (
                  <Table.Row key={c.id}>
                    <Table.Cell>
                      <StatusLabel status={c.status} />
                    </Table.Cell>
                    <Table.Cell className="font-medium">{c.name}</Table.Cell>
                    <Table.Cell>
                      <Badge variant="neutral" className="text-[10px]">
                        {c.type}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-xs text-kumo-subtle">{c.status}</Table.Cell>
                    <Table.Cell className="text-xs text-kumo-subtle">
                      {c.expiresAt ? relativeDate(c.expiresAt) : '—'}
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
                            icon={<ArrowClockwise size={16} />}
                            onClick={() => void test(c)}
                          >
                            验证
                          </DropdownMenu.Item>
                          {c.type === 'oauth' && (
                            <DropdownMenu.Item
                              icon={<Key size={16} />}
                              onClick={() => void authorize(c)}
                            >
                              授权
                            </DropdownMenu.Item>
                          )}
                          {c.type === 'oauth' && c.status !== 'ready' && (
                            <DropdownMenu.Item
                              variant="danger"
                              icon={<ArrowClockwise size={16} />}
                              onClick={async () => {
                                try {
                                  await apiVoid(`/api/v1/credentials/${c.id}/revoke`, {
                                    method: 'POST',
                                  });
                                  toast.success(`${c.name} · 已撤销`);
                                  reload();
                                } catch (cause) {
                                  toast.error('撤销失败', errorMessage(cause));
                                }
                              }}
                            >
                              撤销
                            </DropdownMenu.Item>
                          )}
                          <DropdownMenu.Item
                            icon={<PencilSimple size={16} />}
                            onClick={() => setEditing(c)}
                          >
                            编辑
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            variant="danger"
                            icon={<Trash size={16} />}
                            onClick={() => setDeleting(c)}
                          >
                            删除
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </div>

      <CredentialFormDialog
        key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
        open={editing !== null}
        credential={editing === 'new' ? null : editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={async (c) => {
          setEditing(null);
          toast.success(`${c.name} 已保存`);
          reload();
        }}
      />

      <Dialog.Root open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <Dialog size="sm" className="p-6">
          <Dialog.Title className="text-base font-semibold">删除 {deleting?.name}?</Dialog.Title>
          <Dialog.Description className="text-kumo-subtle">
            凭据将被永久删除,绑定它的 Server 需重新配置。
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close render={<Button variant="secondary" size="sm">取消</Button>} />
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await apiVoid(`/api/v1/credentials/${deleting.id}`, { method: 'DELETE' });
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
