import * as Tabs from '@radix-ui/react-tabs';
import { KeyRound, Lock, Plus, Shield, Trash2, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { CopyField } from '../components/ui/CopyField.js';
import { Modal } from '../components/ui/Dialog.js';
import { EmptyState, LoadError, Page } from '../components/ui/Page.js';
import { api, errorMessage } from '../lib/api.js';
import { apiKeyRecordSchema, issuedKeySchema, type ApiKeyRecord } from '../lib/contracts.js';

type KeyKind = 'control' | 'access';

export function KeysPage({ notify }: { notify(title: string, detail?: string): void }): ReactNode {
  const [control, setControl] = useState<ApiKeyRecord[]>([]);
  const [access, setAccess] = useState<ApiKeyRecord[]>([]);
  const [creating, setCreating] = useState<KeyKind | null>(null);
  const [secret, setSecret] = useState<{ value: string; kind: KeyKind } | null>(null);
  const [revoking, setRevoking] = useState<ApiKeyRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [controlKeys, accessKeys] = await Promise.all([
        api('/api/v1/control-keys', apiKeyRecordSchema.array()),
        api('/api/v1/access-keys', apiKeyRecordSchema.array()),
      ]);
      setControl(controlKeys);
      setAccess(accessKeys);
    } catch (cause) {
      setLoadError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Page
      eyebrow="Access boundary"
      title="API Keys"
      description="控制面和数据面使用两类不可互换的身份，减少 Harness 的权限。"
    >
      {loadError && <LoadError message={loadError} onRetry={load} />}
      <div className="key-boundary">
        <Boundary
          icon={Lock}
          index="01"
          title="Control API Key"
          description="管理 Server、Credential、Key 与运行状态。只用于 Web、CLI 或管理 Agent。"
          prefix="mch_ctl_"
        />
        <Boundary
          icon={Shield}
          index="02"
          title="MCP Access API Key"
          description="只能调用聚合或独立 MCP endpoint，不能读取和修改控制面。"
          prefix="mch_mcp_"
        />
      </div>
      <Tabs.Root className="tabs key-tabs" defaultValue="access">
        <Tabs.List className="tabs-list">
          <Tabs.Trigger value="access">
            <Shield size={15} />
            MCP Access
          </Tabs.Trigger>
          <Tabs.Trigger value="control">
            <Lock size={15} />
            Control API
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="access" className="tab-panel">
          <KeyList
            kind="access"
            items={access}
            onCreate={() => setCreating('access')}
            onRevoke={setRevoking}
          />
        </Tabs.Content>
        <Tabs.Content value="control" className="tab-panel">
          <KeyList
            kind="control"
            items={control}
            onCreate={() => setCreating('control')}
            onRevoke={setRevoking}
          />
        </Tabs.Content>
      </Tabs.Root>

      <CreateKeyModal
        kind={creating}
        onOpenChange={(open) => {
          if (!open) setCreating(null);
        }}
        onCreated={async (kind, value) => {
          setCreating(null);
          setSecret({ kind, value });
          await load();
        }}
      />
      <Modal
        open={secret !== null}
        onOpenChange={(open) => {
          if (!open) setSecret(null);
        }}
        title="保存新的 API Key"
        description="完整 Secret 只显示这一次。关闭后无法再次读取。"
      >
        {secret && (
          <div className="secret-panel">
            <span>{secret.kind === 'control' ? 'Control API Key' : 'MCP Access API Key'}</span>
            <CopyField value={secret.value} />
            <div className="dialog-actions">
              <Button onClick={() => setSecret(null)}>我已安全保存</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        title="撤销这个 API Key？"
        description={
          revoking ? `${revoking.name} 将立即失效，正在使用它的客户端需要更新配置。` : ''
        }
        confirmLabel="撤销 Key"
        onConfirm={async () => {
          if (!revoking) return;
          const target = revoking;
          const path = target.kind === 'control' ? 'control-keys' : 'access-keys';
          await api(`/api/v1/${path}/${target.id}`, z.unknown(), { method: 'DELETE' });
          setRevoking(null);
          notify(`${target.name} 已撤销`);
          await load();
        }}
      />
    </Page>
  );
}

function Boundary({
  icon: Icon,
  index,
  title,
  description,
  prefix,
}: {
  icon: LucideIcon;
  index: string;
  title: string;
  description: string;
  prefix: string;
}): ReactNode {
  return (
    <article className="boundary-card">
      <div>
        <span className="boundary-icon">
          <Icon size={17} />
        </span>
        <span className="section-index">{index}</span>
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <code>{prefix}</code>
    </article>
  );
}

function KeyList({
  kind,
  items,
  onCreate,
  onRevoke,
}: {
  kind: KeyKind;
  items: ApiKeyRecord[];
  onCreate(): void;
  onRevoke(key: ApiKeyRecord): void;
}): ReactNode {
  return (
    <section className="key-list-block">
      <div className="section-heading">
        <div>
          <span className="section-index">
            {kind === 'control' ? 'Management identity' : 'Harness identity'}
          </span>
          <h2>{kind === 'control' ? 'Control API Keys' : 'MCP Access API Keys'}</h2>
        </div>
        <Button onClick={onCreate}>
          <Plus size={15} />
          创建 Key
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="没有 Key"
          description={`创建一个 ${kind === 'control' ? 'Control API' : 'MCP Access'} Key。`}
        />
      ) : (
        <div className="key-table">
          <div className="key-row key-row-head">
            <span>Name</span>
            <span>Prefix</span>
            <span>Last used</span>
            <span>Created</span>
            <span />
          </div>
          {items.map((item) => (
            <div className="key-row" key={item.id}>
              <div>
                <KeyRound size={15} />
                <strong>{item.name}</strong>
              </div>
              <code>{item.prefix}…</code>
              <span>{item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString() : 'Never'}</span>
              <span>{new Date(item.createdAt).toLocaleDateString()}</span>
              <Button
                variant="quiet"
                size="icon"
                aria-label="撤销"
                disabled={item.revokedAt !== null}
                onClick={() => onRevoke(item)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CreateKeyModal({
  kind,
  onOpenChange,
  onCreated,
}: {
  kind: KeyKind | null;
  onOpenChange(open: boolean): void;
  onCreated(kind: KeyKind, value: string): void | Promise<void>;
}): ReactNode {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (kind) setError(null);
  }, [kind]);
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!kind) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    if (name === '') return;
    setError(null);
    setSaving(true);
    try {
      const path = kind === 'control' ? 'control-keys' : 'access-keys';
      const result = await api(`/api/v1/${path}`, issuedKeySchema, {
        method: 'POST',
        body: { name },
      });
      await onCreated(kind, result.secret);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={kind !== null}
      onOpenChange={onOpenChange}
      title={`创建 ${kind === 'control' ? 'Control API' : 'MCP Access'} Key`}
      description="为每个用途创建独立 Key，便于单独撤销和追踪。"
    >
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>Key name</span>
          <input
            name="name"
            placeholder={kind === 'control' ? 'Personal CLI' : 'Claude Code on MacBook'}
            autoFocus
            required
          />
        </label>
        {error && <div className="inline-error">{error}</div>}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? '正在创建' : '创建 Key'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
