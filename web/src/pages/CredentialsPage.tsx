import {
  Cable,
  CheckCircle2,
  CircleAlert,
  Clock3,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { Modal } from '../components/ui/Dialog.js';
import { EmptyState, LoadError, Page } from '../components/ui/Page.js';
import { SelectField } from '../components/ui/SelectField.js';
import { api, errorMessage } from '../lib/api.js';
import {
  authorizationResultSchema,
  credentialRecordSchema,
  type CredentialRecord,
} from '../lib/contracts.js';

const emptySchema = z.unknown();
const stringMapSchema = z.record(z.string(), z.string());
type CredentialType = CredentialRecord['type'];

export function CredentialsPage({
  notify,
}: {
  notify(title: string, detail?: string): void;
}): ReactNode {
  const [items, setItems] = useState<CredentialRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<CredentialRecord | null>(null);
  const [deleting, setDeleting] = useState<CredentialRecord | null>(null);
  const [revoking, setRevoking] = useState<CredentialRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await api('/api/v1/credentials', credentialRecordSchema.array()));
    } catch (cause) {
      setLoadError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const authorize = async (credential: CredentialRecord): Promise<void> => {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setBusyId(credential.id);
    try {
      const result = await api(
        `/api/v1/credentials/${credential.id}/authorize`,
        authorizationResultSchema,
        { method: 'POST', body: {} },
      );
      if (result.authorizationUrl) {
        if (popup) popup.location.href = result.authorizationUrl;
        else window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer');
        notify('已打开上游授权页', '完成授权后，Credential 状态会自动更新。');
        const outcome = await waitForOAuth(credential.id, popup);
        await load();
        if (outcome === 'ready') notify(`${credential.name} 已授权并连接`);
        else if (outcome === 'closed') notify('授权窗口已关闭', '尚未确认 Credential 已就绪。');
        else if (outcome === 'timeout') {
          notify('仍在等待授权', '可以稍后重新进入 Credentials 查看状态。');
        }
      } else {
        popup?.close();
        notify(`${credential.name} 已授权`);
        await load();
      }
    } catch (cause) {
      popup?.close();
      notify('无法开始授权', errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  const test = async (credential: CredentialRecord): Promise<void> => {
    setBusyId(credential.id);
    try {
      const result = await api(
        `/api/v1/credentials/${credential.id}/test`,
        z.record(z.string(), z.unknown()),
        { method: 'POST' },
      );
      notify(`${credential.name} 已验证`, JSON.stringify(result));
    } catch (cause) {
      notify('Credential 验证失败', errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Page
      eyebrow="Encrypted upstream secrets"
      title="Credentials"
      description="上游身份留在 MCP Home；Harness 使用独立的 MCP Access 身份。"
      action={
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} />
          添加 Credential
        </Button>
      }
    >
      {loadError && <LoadError message={loadError} onRetry={load} />}
      <section className="credential-principle">
        <div>
          <LockKeyhole size={19} strokeWidth={1.7} />
          <span>Encrypted at rest</span>
        </div>
        <p>
          OAuth 使用官方发现、PKCE、CIMD/DCR 与刷新流程。OAuth credential
          按资源绑定，只能关联一个远程 Server。
        </p>
      </section>
      <div className="credential-grid">
        {items.map((credential) => (
          <article className="credential-card" key={credential.id}>
            <header>
              <span className="credential-icon">
                {credential.type === 'oauth' ? <Cable size={18} /> : <KeyRound size={18} />}
              </span>
              <StatusBadge status={credential.status} />
            </header>
            <div>
              <span className="section-index">{credential.type}</span>
              <h2>{credential.name}</h2>
            </div>
            <dl>
              <div>
                <dt>Expires</dt>
                <dd>
                  {credential.expiresAt
                    ? new Date(credential.expiresAt).toLocaleString()
                    : 'Not specified'}
                </dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{new Date(credential.updatedAt).toLocaleDateString()}</dd>
              </div>
            </dl>
            <footer>
              {credential.type === 'oauth' && (
                <Button
                  size="small"
                  onClick={() => void authorize(credential)}
                  disabled={busyId === credential.id}
                >
                  <ShieldCheck size={15} />
                  {credential.status === 'ready' ? '重新授权' : '授权'}
                </Button>
              )}
              <Button
                variant="quiet"
                size="small"
                onClick={() => void test(credential)}
                disabled={busyId === credential.id}
              >
                <RefreshCw size={14} className={busyId === credential.id ? 'spin' : ''} />
                验证
              </Button>
              <Button
                variant="quiet"
                size="icon"
                aria-label="重命名"
                onClick={() => setRenaming(credential)}
              >
                <Pencil size={15} />
              </Button>
              {credential.type === 'oauth' && credential.status !== 'pending' && (
                <Button variant="quiet" size="small" onClick={() => setRevoking(credential)}>
                  撤销
                </Button>
              )}
              <Button
                variant="quiet"
                size="icon"
                aria-label="删除"
                onClick={() => setDeleting(credential)}
              >
                <Trash2 size={15} />
              </Button>
            </footer>
          </article>
        ))}
      </div>
      {items.length === 0 && (
        <EmptyState
          title="还没有上游 Credential"
          description="先保存上游身份，再在 Server 配置中关联。Secret 创建后不会从 Control API 返回。"
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} />
              添加 Credential
            </Button>
          }
        />
      )}

      <CreateCredentialModal
        open={creating}
        onOpenChange={setCreating}
        onCreated={async (credential) => {
          setCreating(false);
          notify(`${credential.name} 已加密保存`);
          await load();
        }}
      />
      <RenameCredentialModal
        credential={renaming}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        onSaved={async (credential) => {
          setRenaming(null);
          notify(`${credential.name} 已更新`);
          await load();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="删除这个 Credential？"
        description={
          deleting
            ? `${deleting.name} 的加密 Secret 将被永久删除，关联的 Server 会失去上游身份。`
            : ''
        }
        confirmLabel="删除 Credential"
        onConfirm={async () => {
          if (!deleting) return;
          await api(`/api/v1/credentials/${deleting.id}`, emptySchema, { method: 'DELETE' });
          notify(`${deleting.name} 已删除`);
          setDeleting(null);
          await load();
        }}
      />
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        title="撤销 OAuth tokens？"
        description={
          revoking
            ? `MCP Home 会先尝试调用 ${revoking.name} 的远程 revocation endpoint，再清除本地令牌。`
            : ''
        }
        confirmLabel="撤销 Tokens"
        onConfirm={async () => {
          if (!revoking) return;
          const target = revoking;
          await api(`/api/v1/credentials/${target.id}/revoke`, emptySchema, { method: 'POST' });
          notify(`${target.name} 已撤销`);
          setRevoking(null);
          await load();
        }}
      />
    </Page>
  );
}

function CreateCredentialModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated(credential: CredentialRecord): void | Promise<void>;
}): ReactNode {
  const [type, setType] = useState<CredentialType>('oauth');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const payload = credentialPayload(type, form);
      const credential = await api('/api/v1/credentials', credentialRecordSchema, {
        method: 'POST',
        body: { name: required(form, 'name'), payload },
      });
      await onCreated(credential);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="添加 Credential"
      description="Secret 使用 AES-GCM 加密；创建后只返回脱敏记录。"
    >
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label className="field">
            <span>名称</span>
            <input name="name" placeholder="GitHub OAuth" required />
          </label>
          <SelectField
            label="类型"
            value={type}
            onValueChange={(value) => setType(credentialType(value))}
            options={[
              { value: 'oauth', label: 'OAuth / OIDC' },
              { value: 'bearer', label: 'Bearer token' },
              { value: 'api-key', label: 'API key header' },
              { value: 'headers', label: 'Custom headers' },
              { value: 'env', label: 'Environment map' },
            ]}
          />
        </div>
        <div className="form-section">
          <span>Secret material</span>
        </div>
        {type === 'oauth' && (
          <>
            <div className="oauth-note">
              <ShieldCheck size={17} />
              <p>
                Access token 可以留空。将 Credential 关联到 Remote Server 后，点击“授权”即可走完整
                OAuth/OIDC 流程。
              </p>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Scopes</span>
                <input name="scope" placeholder="可选，由服务端发现" />
              </label>
              <label className="field">
                <span>预注册 Client ID</span>
                <input name="clientId" placeholder="可选，默认 CIMD / DCR" />
              </label>
              <label className="field">
                <span>Client secret</span>
                <input name="clientSecret" type="password" autoComplete="new-password" />
              </label>
              <label className="field">
                <span>现有 Access token</span>
                <input name="accessToken" type="password" autoComplete="off" />
              </label>
              <label className="field">
                <span>Refresh token</span>
                <input name="refreshToken" type="password" autoComplete="off" />
              </label>
            </div>
          </>
        )}
        {type === 'bearer' && (
          <label className="field">
            <span>Bearer token</span>
            <textarea name="secret" rows={4} required />
          </label>
        )}
        {type === 'api-key' && (
          <div className="form-grid">
            <label className="field">
              <span>Header name</span>
              <input name="headerName" placeholder="X-API-Key" required />
            </label>
            <label className="field">
              <span>Value</span>
              <input name="secret" type="password" required />
            </label>
          </div>
        )}
        {(type === 'headers' || type === 'env') && (
          <label className="field">
            <span>{type === 'headers' ? 'Headers' : 'Environment'} · JSON</span>
            <textarea name="map" rows={7} defaultValue="{}" required />
          </label>
        )}
        {error && <div className="inline-error">{error}</div>}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? '正在加密' : '加密保存'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RenameCredentialModal({
  credential,
  onOpenChange,
  onSaved,
}: {
  credential: CredentialRecord | null;
  onOpenChange(open: boolean): void;
  onSaved(credential: CredentialRecord): void | Promise<void>;
}): ReactNode {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (credential) setError(null);
  }, [credential]);
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!credential) return;
    setError(null);
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const saved = await api(`/api/v1/credentials/${credential.id}`, credentialRecordSchema, {
        method: 'PATCH',
        body: { name: required(form, 'name') },
      });
      await onSaved(saved);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={credential !== null} onOpenChange={onOpenChange} title="重命名 Credential">
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>名称</span>
          <input name="name" defaultValue={credential?.name} required />
        </label>
        {error && <div className="inline-error">{error}</div>}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? '正在保存' : '保存名称'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StatusBadge({ status }: { status: CredentialRecord['status'] }): ReactNode {
  const icon =
    status === 'ready' ? (
      <CheckCircle2 size={14} />
    ) : status === 'pending' ? (
      <Clock3 size={14} />
    ) : (
      <CircleAlert size={14} />
    );
  return (
    <span className={`credential-status credential-status-${status}`}>
      {icon}
      {status}
    </span>
  );
}

function credentialPayload(type: CredentialType, form: FormData): Record<string, unknown> {
  if (type === 'bearer') return { type, token: required(form, 'secret') };
  if (type === 'api-key')
    return { type, headerName: required(form, 'headerName'), value: required(form, 'secret') };
  if (type === 'headers')
    return { type, headers: stringMapSchema.parse(JSON.parse(required(form, 'map'))) };
  if (type === 'env')
    return { type, variables: stringMapSchema.parse(JSON.parse(required(form, 'map'))) };
  return {
    type,
    ...optionalProperty('scope', optional(form, 'scope')),
    ...optionalProperty('clientId', optional(form, 'clientId')),
    ...optionalProperty('clientSecret', optional(form, 'clientSecret')),
    ...optionalProperty('accessToken', optional(form, 'accessToken')),
    ...optionalProperty('refreshToken', optional(form, 'refreshToken')),
  };
}

function optionalProperty(name: string, value: string): Record<string, string> {
  return value === '' ? {} : { [name]: value };
}

function credentialType(value: string): CredentialType {
  if (value === 'bearer' || value === 'api-key' || value === 'headers' || value === 'env')
    return value;
  return 'oauth';
}

function required(form: FormData, name: string): string {
  const value = form.get(name);
  if (value === null || String(value).trim() === '') throw new Error(`${name} is required`);
  return String(value).trim();
}

function optional(form: FormData, name: string): string {
  const value = form.get(name);
  return value === null ? '' : String(value).trim();
}

async function waitForOAuth(
  credentialId: string,
  popup: Window | null,
): Promise<'ready' | 'closed' | 'timeout'> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 1_500));
    const credential = await api(`/api/v1/credentials/${credentialId}`, credentialRecordSchema);
    if (credential.status === 'ready') {
      popup?.close();
      return 'ready';
    }
    if (popup?.closed && attempt > 1) return 'closed';
  }
  return 'timeout';
}
