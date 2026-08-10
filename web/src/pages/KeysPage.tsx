import { DotsThreeVertical, Plus } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
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
import { SecretReveal } from '@/components/shared/SecretReveal';
import { api, apiVoid, errorMessage } from '@/lib/api';
import { apiKeyRecordSchema, issuedKeySchema, type ApiKeyRecord } from '@/lib/contracts';
import { useResource, useToast } from '@/lib/hooks';
import { relativeDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Kind = 'access' | 'control';

export function KeysPage() {
  const [kind, setKind] = useState<Kind>('access');
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyRecord | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const list = useResource(`/api/v1/${kind}-keys`, apiKeyRecordSchema.array());
  const toast = useToast();
  const reload = list.reload;

  return (
    <>
      <PageHeader title={kind === 'access' ? 'Access Keys' : 'Control Keys'}>
        <div className="flex items-center gap-0.5 rounded-md border border-kumo-line p-0.5">
          {(['access', 'control'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                'rounded px-2 py-0.5 text-xs transition-colors',
                kind === k
                  ? 'bg-kumo-tint text-kumo-strong'
                  : 'text-kumo-subtle hover:text-kumo-default',
              )}
            >
              {k === 'access' ? 'Access' : 'Control'}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus size={16} /> 新建
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
            title={`还没有 ${kind === 'access' ? 'Access' : 'Control'} Key`}
            description={
              kind === 'access'
                ? 'Access Key 供 Harness 连接 /mcp 端点。'
                : 'Control Key 用于登录控制台。'
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-kumo-line">
            <Table>
              <Table.Header variant="compact">
                <Table.Row>
                  <Table.Head>名称</Table.Head>
                  <Table.Head>前缀</Table.Head>
                  <Table.Head>创建</Table.Head>
                  <Table.Head>最近使用</Table.Head>
                  <Table.Head>状态</Table.Head>
                  <Table.Head />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {list.data.map((key) => (
                  <Table.Row key={key.id}>
                    <Table.Cell className="font-medium">{key.name}</Table.Cell>
                    <Table.Cell className="font-mono text-xs text-kumo-subtle">
                      {key.prefix}…
                    </Table.Cell>
                    <Table.Cell className="text-xs text-kumo-subtle">
                      {relativeDate(key.createdAt)}
                    </Table.Cell>
                    <Table.Cell className="text-xs text-kumo-subtle">
                      {relativeDate(key.lastUsedAt)}
                    </Table.Cell>
                    <Table.Cell>
                      {key.revokedAt ? (
                        <Badge variant="neutral">已撤销</Badge>
                      ) : (
                        <Badge variant="success">活跃</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {!key.revokedAt && (
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
                              variant="danger"
                              onClick={() => setRevoking(key)}
                            >
                              撤销
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </div>

      <CreateKeyDialog
        kind={kind}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(s) => {
          setSecret(s);
          reload();
        }}
      />

      <SecretReveal
        open={secret !== null}
        onOpenChange={(o) => !o && setSecret(null)}
        secret={secret}
        label={kind === 'access' ? 'Access Key' : 'Control Key'}
      />

      <Dialog.Root open={revoking !== null} onOpenChange={(o) => !o && setRevoking(null)}>
        <Dialog size="sm" className="p-6">
          <Dialog.Title className="text-base font-semibold">撤销此 Key?</Dialog.Title>
          <Dialog.Description className="text-kumo-subtle">
            撤销后该 Key 立即失效,且无法恢复。{revoking?.name}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close render={<Button variant="secondary" size="sm">取消</Button>} />
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!revoking) return;
                try {
                  await apiVoid(`/api/v1/${kind}-keys/${revoking.id}`, { method: 'DELETE' });
                  toast.success('已撤销');
                  setRevoking(null);
                  reload();
                } catch (cause) {
                  toast.error('撤销失败', errorMessage(cause));
                }
              }}
            >
              撤销
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function CreateKeyDialog({
  kind,
  open,
  onOpenChange,
  onCreated,
}: {
  kind: Kind;
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated(secret: string): void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api(`/api/v1/${kind}-keys`, issuedKeySchema, {
        method: 'POST',
        body: { name: name.trim() },
      });
      onCreated(res.secret);
      setName('');
      onOpenChange(false);
    } catch (cause) {
      toast.error('创建失败', errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="sm" className="p-6">
        <Dialog.Title className="mb-1 text-base font-semibold">
          新建 {kind === 'access' ? 'Access' : 'Control'} Key
        </Dialog.Title>
        <Dialog.Description className="text-kumo-subtle">为这把 Key 命名,便于后续识别。</Dialog.Description>
        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
          <Input
            label="名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="laptop · ci · ci-prod"
            autoFocus
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={saving}>
              {saving ? '创建中…' : '创建'}
            </Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
}
