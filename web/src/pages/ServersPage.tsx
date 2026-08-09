import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  CircleAlert,
  CircleCheck,
  CircleOff,
  Code2,
  FileSearch,
  Globe2,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  TerminalSquare,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { CopyField } from '../components/ui/CopyField.js';
import { Modal } from '../components/ui/Dialog.js';
import { EmptyState, LoadError, Page } from '../components/ui/Page.js';
import { SelectField } from '../components/ui/SelectField.js';
import { SwitchField } from '../components/ui/SwitchField.js';
import { api, errorMessage } from '../lib/api.js';
import {
  credentialRecordSchema,
  serverEndpointSchema,
  serverRecordSchema,
  serverStatusSchema,
  type CredentialRecord,
  type ServerRecord,
  type ServerStatus,
} from '../lib/contracts.js';

const emptySchema = z.unknown();
const stringMapSchema = z.record(z.string(), z.string());

export function ServersPage({
  notify,
}: {
  notify(title: string, detail?: string): void;
}): ReactNode {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ServerStatus | null>>({});
  const [editing, setEditing] = useState<ServerRecord | null | 'new'>(null);
  const [inspecting, setInspecting] = useState<ServerStatus | null>(null);
  const [deleting, setDeleting] = useState<ServerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [serverList, credentialList] = await Promise.all([
        api('/api/v1/servers', serverRecordSchema.array()),
        api('/api/v1/credentials', credentialRecordSchema.array()),
      ]);
      setServers(serverList);
      setCredentials(credentialList);
      const statusEntries = await Promise.all(
        serverList.map(async (server): Promise<[string, ServerStatus | null]> => {
          try {
            return [
              server.id,
              await api(`/api/v1/servers/${server.id}/status`, serverStatusSchema),
            ];
          } catch {
            return [server.id, null];
          }
        }),
      );
      setStatuses(Object.fromEntries(statusEntries));
    } catch (cause) {
      setLoadError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (server: ServerRecord, action: string): Promise<void> => {
    try {
      await api(`/api/v1/servers/${server.id}/${action}`, emptySchema, { method: 'POST' });
      notify(`${server.name} 已${actionLabel(action)}`);
      await load();
    } catch (cause) {
      notify(`${server.name} 操作失败`, errorMessage(cause));
    }
  };

  return (
    <Page
      eyebrow="MCP registry"
      title="Servers"
      description="独立入口保留原始协议语义；启用的 Server 同时进入聚合入口。"
      action={
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} />
          添加 Server
        </Button>
      }
    >
      {loadError && <LoadError message={loadError} onRetry={load} />}
      <div className="table-head server-grid">
        <span>Server</span>
        <span>Runtime</span>
        <span>Protocol</span>
        <span>Endpoint</span>
        <span />
      </div>
      <div className="server-list">
        {servers.map((server) => {
          const status = statuses[server.id]?.runtime ?? null;
          return (
            <article className="server-item server-grid" key={server.id}>
              <div className="server-main">
                <span className="server-icon">
                  {server.kind === 'remote' ? <Globe2 size={18} /> : <TerminalSquare size={18} />}
                </span>
                <div>
                  <strong>{server.name}</strong>
                  <code>{server.slug}</code>
                </div>
              </div>
              <div className="runtime-cell">
                <RuntimeIcon status={status?.status ?? (server.enabled ? 'unknown' : 'disabled')} />
                <div>
                  <strong>{status?.status ?? (server.enabled ? 'unknown' : 'disabled')}</strong>
                  <small>
                    {status?.lastSuccessAt
                      ? relativeDate(status.lastSuccessAt)
                      : 'No successful probe'}
                  </small>
                </div>
              </div>
              <div className="protocol-cell">
                <span>{status?.protocolEra ?? server.transport.protocolMode}</span>
                <small>{status?.protocolVersion ?? transportLabel(server)}</small>
              </div>
              <div className="endpoint-cell">
                <code>/mcp/{server.slug}</code>
                <small>
                  {server.transport.type === 'streamable-http'
                    ? server.transport.url
                    : server.transport.command}
                </small>
              </div>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button variant="quiet" size="icon" aria-label={`${server.name} 操作`}>
                    <MoreHorizontal size={18} />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="menu-content" align="end" sideOffset={6}>
                    <MenuItem
                      icon={FileSearch}
                      onSelect={() => {
                        const detail = statuses[server.id];
                        if (detail) setInspecting(detail);
                      }}
                    >
                      查看详情
                    </MenuItem>
                    <MenuItem icon={Pencil} onSelect={() => setEditing(server)}>
                      编辑配置
                    </MenuItem>
                    <DropdownMenu.Separator className="menu-separator" />
                    <MenuItem icon={Play} onSelect={() => void runAction(server, 'test')}>
                      测试连接
                    </MenuItem>
                    <MenuItem icon={RefreshCw} onSelect={() => void runAction(server, 'refresh')}>
                      刷新能力
                    </MenuItem>
                    {server.kind === 'home' && (
                      <MenuItem icon={RotateCcw} onSelect={() => void runAction(server, 'restart')}>
                        重启进程
                      </MenuItem>
                    )}
                    <MenuItem
                      icon={Power}
                      onSelect={() => void runAction(server, server.enabled ? 'disable' : 'enable')}
                    >
                      {server.enabled ? '停用' : '启用'}
                    </MenuItem>
                    <DropdownMenu.Separator className="menu-separator" />
                    <MenuItem icon={Trash2} danger onSelect={() => setDeleting(server)}>
                      删除 Server
                    </MenuItem>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </article>
          );
        })}
      </div>
      {!loading && servers.length === 0 && (
        <EmptyState
          title="还没有 MCP Server"
          description="添加 Remote-native HTTP Server，或由 MCP Home 托管一个 stdio Server。"
          action={
            <Button onClick={() => setEditing('new')}>
              <Plus size={16} />
              添加第一个 Server
            </Button>
          }
        />
      )}
      {loading && servers.length === 0 && (
        <div className="table-loading">
          <LoaderCircle className="spin" size={18} />
          读取 Server registry
        </div>
      )}

      <ServerFormModal
        key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
        open={editing !== null}
        server={editing === 'new' ? null : editing}
        credentials={credentials}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={async (server) => {
          setEditing(null);
          notify(`${server.name} 已保存`);
          await load();
        }}
      />
      <ServerInspector
        status={inspecting}
        onOpenChange={(open) => {
          if (!open) setInspecting(null);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="删除这个 Server？"
        description={
          deleting
            ? `${deleting.name} 的配置、能力快照与运行日志将被删除。上游服务本身不会被删除。`
            : ''
        }
        confirmLabel="删除 Server"
        onConfirm={async () => {
          if (!deleting) return;
          await api(`/api/v1/servers/${deleting.id}`, emptySchema, { method: 'DELETE' });
          notify(`${deleting.name} 已删除`);
          setDeleting(null);
          await load();
        }}
      />
    </Page>
  );
}

function ServerFormModal({
  open,
  onOpenChange,
  server,
  credentials,
  onSaved,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  server: ServerRecord | null;
  credentials: CredentialRecord[];
  onSaved(server: ServerRecord): void | Promise<void>;
}): ReactNode {
  const [kind, setKind] = useState<'remote' | 'home'>(server?.kind ?? 'remote');
  const [protocolMode, setProtocolMode] = useState<'auto' | 'legacy' | 'modern'>(
    server?.transport.protocolMode ?? 'auto',
  );
  const [credentialId, setCredentialId] = useState(server?.credentialId ?? 'none');
  const [sseFallback, setSseFallback] = useState(
    server?.transport.type === 'streamable-http' ? server.transport.allowSseFallback : false,
  );
  const [enabled, setEnabled] = useState(server?.enabled ?? true);
  const [restart, setRestart] = useState<'never' | 'on-failure' | 'always'>(
    server?.settings.restart ?? 'on-failure',
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const selectedKind = server?.kind ?? kind;
      const transport =
        selectedKind === 'remote'
          ? {
              type: 'streamable-http',
              url: required(form, 'url'),
              protocolMode,
              allowSseFallback: sseFallback,
              headers: parseMap(optional(form, 'headers')),
            }
          : {
              type: 'stdio',
              command: required(form, 'command'),
              args: optional(form, 'args')
                .split('\n')
                .map((value) => value.trim())
                .filter(Boolean),
              ...(optional(form, 'cwd') === '' ? {} : { cwd: optional(form, 'cwd') }),
              env: parseMap(optional(form, 'env')),
              protocolMode,
            };
      const common = {
        name: required(form, 'name'),
        transport,
        credentialId: credentialId === 'none' ? null : credentialId,
        enabled,
        settings: {
          connectTimeoutMs: Number(required(form, 'connectTimeoutMs')),
          requestTimeoutMs: Number(required(form, 'requestTimeoutMs')),
          maxTotalTimeoutMs: Number(required(form, 'maxTotalTimeoutMs')),
          maxConcurrency: Number(required(form, 'maxConcurrency')),
          restart: selectedKind === 'home' ? restart : 'never',
        },
      };
      const saved = server
        ? await api(`/api/v1/servers/${server.id}`, serverRecordSchema, {
            method: 'PATCH',
            body: common,
          })
        : await api('/api/v1/servers', serverRecordSchema, {
            method: 'POST',
            body: { ...common, slug: required(form, 'slug'), kind: selectedKind },
          });
      await onSaved(saved);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const remote = (server?.kind ?? kind) === 'remote';
  const transport = server?.transport;
  const compatibleCredentials = credentials.filter((credential) =>
    remote ? credential.type !== 'env' : credential.type === 'env',
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={server ? `编辑 ${server.name}` : '添加 MCP Server'}
      description="配置只描述上游；MCP Home 自动生成聚合与独立入口。"
    >
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <TextField
            label="名称"
            name="name"
            defaultValue={server?.name}
            placeholder="GitHub"
            required
          />
          <TextField
            label="Slug"
            name="slug"
            defaultValue={server?.slug}
            placeholder="github"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            disabled={server !== null}
            required
          />
          {!server && (
            <SelectField
              label="运行位置"
              value={kind}
              onValueChange={(value) => setKind(value === 'home' ? 'home' : 'remote')}
              options={[
                { value: 'remote', label: 'Remote-native' },
                { value: 'home', label: 'Home-hosted' },
              ]}
            />
          )}
          <SelectField
            label="协议协商"
            value={protocolMode}
            onValueChange={(value) => setProtocolMode(protocolValue(value))}
            options={[
              { value: 'auto', label: 'Auto negotiate' },
              { value: 'modern', label: 'Modern · 2026-07-28' },
              { value: 'legacy', label: 'Legacy · 2025 era' },
            ]}
          />
        </div>

        <div className="form-section">
          <span>Transport</span>
        </div>
        {remote ? (
          <>
            <TextField
              className="wide"
              label="Streamable HTTP URL"
              name="url"
              type="url"
              defaultValue={transport?.type === 'streamable-http' ? transport.url : ''}
              placeholder="https://mcp.example.com/mcp"
              required
            />
            <TextAreaField
              label="静态 Headers · JSON"
              name="headers"
              defaultValue={
                transport?.type === 'streamable-http'
                  ? JSON.stringify(transport.headers, null, 2)
                  : '{}'
              }
              rows={3}
            />
            <SwitchField
              label="SSE fallback"
              description="Streamable HTTP 失败后尝试旧 SSE transport。"
              checked={sseFallback}
              onCheckedChange={setSseFallback}
            />
          </>
        ) : (
          <div className="form-grid">
            <TextField
              label="Command"
              name="command"
              defaultValue={transport?.type === 'stdio' ? transport.command : ''}
              placeholder="npx"
              required
            />
            <TextField
              label="Working directory"
              name="cwd"
              defaultValue={transport?.type === 'stdio' ? transport.cwd : ''}
              placeholder="可选"
            />
            <TextAreaField
              className="wide"
              label="Arguments · 每行一个"
              name="args"
              defaultValue={transport?.type === 'stdio' ? transport.args.join('\n') : ''}
              rows={4}
            />
            <TextAreaField
              className="wide"
              label="Environment · JSON"
              name="env"
              defaultValue={
                transport?.type === 'stdio' ? JSON.stringify(transport.env, null, 2) : '{}'
              }
              rows={4}
            />
          </div>
        )}

        <div className="form-grid">
          <SelectField
            label="上游 Credential"
            value={credentialId}
            onValueChange={setCredentialId}
            options={[
              { value: 'none', label: 'No credential' },
              ...compatibleCredentials.map((credential) => ({
                value: credential.id,
                label: `${credential.name} · ${credential.type}`,
              })),
            ]}
            hint={
              remote
                ? 'OAuth credential 只能绑定一个 Server。'
                : 'Home-hosted Server 使用 Environment credential。'
            }
          />
          <SwitchField
            label="Enabled"
            description="保存后允许 Harness 访问。"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="form-section">
          <span>Runtime limits</span>
        </div>
        <div className="form-grid form-grid-four">
          <TextField
            label="Connect ms"
            name="connectTimeoutMs"
            type="number"
            defaultValue={server?.settings.connectTimeoutMs ?? 15000}
            required
          />
          <TextField
            label="Request ms"
            name="requestTimeoutMs"
            type="number"
            defaultValue={server?.settings.requestTimeoutMs ?? 60000}
            required
          />
          <TextField
            label="Total ms"
            name="maxTotalTimeoutMs"
            type="number"
            defaultValue={server?.settings.maxTotalTimeoutMs ?? 600000}
            required
          />
          <TextField
            label="Concurrency"
            name="maxConcurrency"
            type="number"
            min="1"
            defaultValue={server?.settings.maxConcurrency ?? 1}
            required
          />
        </div>
        {!remote && (
          <SelectField
            label="Restart policy"
            value={restart}
            onValueChange={(value) => setRestart(restartValue(value))}
            options={[
              { value: 'on-failure', label: 'On failure' },
              { value: 'always', label: 'Always' },
              { value: 'never', label: 'Never' },
            ]}
            hint="只处理 Home-hosted 进程的意外退出；手动重启不受此项影响。"
          />
        )}
        {error && <div className="inline-error">{error}</div>}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? '正在保存' : '保存 Server'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ServerInspector({
  status,
  onOpenChange,
}: {
  status: ServerStatus | null;
  onOpenChange(open: boolean): void;
}): ReactNode {
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setEndpoint(null);
    setError(null);
    if (!status) return;
    void api(`/api/v1/servers/${status.server.id}/endpoint`, serverEndpointSchema)
      .then((value) => setEndpoint(value.individualUrl))
      .catch((cause: unknown) => setError(errorMessage(cause)));
  }, [status]);
  return (
    <Modal
      open={status !== null}
      onOpenChange={onOpenChange}
      title={status?.server.name ?? 'Server detail'}
      description="当前运行时、独立入口与最近能力快照。"
    >
      {status && (
        <div className="inspector">
          <div className="inspector-grid">
            <InspectorValue label="Runtime" value={status.runtime?.status ?? 'unknown'} />
            <InspectorValue
              label="Protocol"
              value={status.runtime?.protocolVersion ?? 'Not negotiated'}
            />
            <InspectorValue label="Era" value={status.runtime?.protocolEra ?? 'unknown'} />
            <InspectorValue label="Restarts" value={String(status.runtime?.restartCount ?? 0)} />
          </div>
          {error && <div className="inline-error">{error}</div>}
          {endpoint && (
            <div>
              <span className="field-label">Individual endpoint</span>
              <CopyField value={endpoint} />
            </div>
          )}
          {status.runtime?.lastError && (
            <div className="inline-error">{status.runtime.lastError}</div>
          )}
          <div className="code-panel compact">
            <div className="code-panel-head">
              <span>capability-snapshot.json</span>
              <Code2 size={14} />
            </div>
            <pre>
              {JSON.stringify(status.snapshot ?? { status: 'snapshot unavailable' }, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MenuItem({
  icon: Icon,
  danger = false,
  onSelect,
  children,
}: {
  icon: LucideIcon;
  danger?: boolean;
  onSelect(): void;
  children: ReactNode;
}): ReactNode {
  return (
    <DropdownMenu.Item
      className={danger ? 'menu-item menu-item-danger' : 'menu-item'}
      onSelect={onSelect}
    >
      <Icon size={15} strokeWidth={1.8} />
      {children}
    </DropdownMenu.Item>
  );
}

function RuntimeIcon({ status }: { status: string }): ReactNode {
  if (status === 'ready') return <CircleCheck className="status-ready" size={18} />;
  if (status === 'connecting') return <LoaderCircle className="status-pending spin" size={18} />;
  if (status === 'disabled' || status === 'unknown')
    return <CircleOff className="status-muted" size={18} />;
  return <CircleAlert className="status-error" size={18} />;
}

function TextField({
  label,
  className,
  ...props
}: { label: string; className?: string } & InputHTMLAttributes<HTMLInputElement>): ReactNode {
  return (
    <label className={className ? `field ${className}` : 'field'}>
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function TextAreaField({
  label,
  className,
  ...props
}: { label: string; className?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>): ReactNode {
  return (
    <label className={className ? `field ${className}` : 'field'}>
      <span>{label}</span>
      <textarea {...props} />
    </label>
  );
}

function InspectorValue({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="inspector-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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

function parseMap(value: string): Record<string, string> {
  if (value === '') return {};
  return stringMapSchema.parse(JSON.parse(value));
}

function protocolValue(value: string): 'auto' | 'legacy' | 'modern' {
  if (value === 'legacy' || value === 'modern') return value;
  return 'auto';
}

function restartValue(value: string): 'never' | 'on-failure' | 'always' {
  if (value === 'never' || value === 'always') return value;
  return 'on-failure';
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    test: '测试',
    refresh: '刷新',
    restart: '重启',
    enable: '启用',
    disable: '停用',
  };
  return labels[action] ?? action;
}

function transportLabel(server: ServerRecord): string {
  return server.transport.type === 'streamable-http' ? 'Streamable HTTP' : 'stdio';
}

function relativeDate(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
