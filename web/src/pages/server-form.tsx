import { useState, type FormEvent } from 'react';
import { Button, Dialog, Input, InputArea, Select, Switch } from '@cloudflare/kumo';
import { api, errorMessage } from '@/lib/api';
import { serverRecordSchema, type CredentialRecord, type ServerRecord } from '@/lib/contracts';

type Kind = 'remote' | 'home';
type ProtocolMode = 'auto' | 'legacy' | 'modern';
type Restart = 'never' | 'on-failure' | 'always';

export function ServerFormDialog({
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
}) {
  const editing = server !== null;
  const [kind, setKind] = useState<Kind>(server?.kind ?? 'remote');
  const [protocolMode, setProtocolMode] = useState<ProtocolMode>(
    server?.transport.protocolMode ?? 'auto',
  );
  const [credentialId, setCredentialId] = useState<string>(server?.credentialId ?? 'none');
  const [sseFallback, setSseFallback] = useState(
    server?.transport.type === 'streamable-http' ? server.transport.allowSseFallback : false,
  );
  const [enabled, setEnabled] = useState(server?.enabled ?? true);
  const [restart, setRestart] = useState<Restart>(server?.settings.restart ?? 'on-failure');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const compatible = credentials.filter((c) =>
    kind === 'remote' ? c.type !== 'env' : c.type === 'env',
  );
  const credentialItems: Record<string, string> = {
    none: '无',
    ...Object.fromEntries(compatible.map((c) => [c.id, `${c.name} · ${c.type}`])),
  };
  const transport = server?.transport;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const builtTransport =
        kind === 'remote'
          ? {
              type: 'streamable-http' as const,
              url: required(form, 'url'),
              protocolMode,
              allowSseFallback: sseFallback,
              headers: parseMap(optional(form, 'headers')),
            }
          : {
              type: 'stdio' as const,
              command: required(form, 'command'),
              args: optional(form, 'args')
                .split('\n')
                .map((v) => v.trim())
                .filter(Boolean),
              ...(optional(form, 'cwd') === '' ? {} : { cwd: optional(form, 'cwd') }),
              env: parseMap(optional(form, 'env')),
              protocolMode,
            };
      const common = {
        name: required(form, 'name'),
        transport: builtTransport,
        credentialId: credentialId === 'none' ? null : credentialId,
        enabled,
        settings: {
          connectTimeoutMs: Number(required(form, 'connectTimeoutMs')),
          requestTimeoutMs: Number(required(form, 'requestTimeoutMs')),
          maxTotalTimeoutMs: Number(required(form, 'maxTotalTimeoutMs')),
          maxConcurrency: Number(required(form, 'maxConcurrency')),
          restart: kind === 'home' ? restart : 'never',
        },
      };
      const saved = editing
        ? await api(`/api/v1/servers/${server!.id}`, serverRecordSchema, {
            method: 'PATCH',
            body: common,
          })
        : await api('/api/v1/servers', serverRecordSchema, {
            method: 'POST',
            body: { ...common, slug: required(form, 'slug'), kind },
          });
      await onSaved(saved);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="xl" className="max-h-[88vh] overflow-y-auto p-6">
        <Dialog.Title className="mb-1 text-base font-semibold">
          {editing ? '编辑 Server' : '添加 Server'}
        </Dialog.Title>
        <Dialog.Description className="text-kumo-subtle">
          {editing ? server!.name : '配置上游 MCP Server'}
        </Dialog.Description>

        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="名称" name="name" defaultValue={server?.name} placeholder="GitHub" required />
            <Input
              label="Slug"
              name="slug"
              defaultValue={server?.slug}
              placeholder="github"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              disabled={editing}
              required
            />
          </div>

          {!editing && (
            <Select
              label="运行位置"
              size="sm"
              value={kind}
              onValueChange={(v) => setKind((v ?? 'remote') as Kind)}
              items={{ remote: 'Remote-native', home: 'Home-hosted' }}
            />
          )}

          {kind === 'remote' ? (
            <>
              <Input
                label="Streamable HTTP URL"
                name="url"
                type="url"
                size="sm"
                defaultValue={transport?.type === 'streamable-http' ? transport.url : ''}
                placeholder="https://mcp.example.com/mcp"
                required
              />
              <InputArea
                label="静态 Headers (JSON)"
                name="headers"
                size="sm"
                rows={2}
                defaultValue={
                  transport?.type === 'streamable-http'
                    ? JSON.stringify(transport.headers, null, 2)
                    : '{}'
                }
              />
              <Switch
                label="SSE fallback"
                size="sm"
                checked={sseFallback}
                onCheckedChange={setSseFallback}
              />
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Command"
                name="command"
                size="sm"
                defaultValue={transport?.type === 'stdio' ? transport.command : ''}
                placeholder="npx"
                required
              />
              <Input
                label="Working dir"
                name="cwd"
                size="sm"
                defaultValue={transport?.type === 'stdio' ? transport.cwd : ''}
                placeholder="可选"
              />
              <div className="col-span-2">
                <InputArea
                  label="Arguments (每行一个)"
                  name="args"
                  size="sm"
                  rows={3}
                  defaultValue={transport?.type === 'stdio' ? transport.args.join('\n') : ''}
                />
              </div>
              <div className="col-span-2">
                <InputArea
                  label="Environment (JSON)"
                  name="env"
                  size="sm"
                  rows={3}
                  defaultValue={
                    transport?.type === 'stdio' ? JSON.stringify(transport.env, null, 2) : '{}'
                  }
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="协议协商"
              size="sm"
              value={protocolMode}
              onValueChange={(v) => setProtocolMode((v ?? 'auto') as ProtocolMode)}
              items={{ auto: 'Auto', modern: 'Modern', legacy: 'Legacy' }}
            />
            <Select
              label="上游 Credential"
              size="sm"
              value={credentialId}
              onValueChange={(v) => setCredentialId(v ?? 'none')}
              items={credentialItems}
            />
          </div>

          <Switch
            label="启用 · 允许 Harness 访问"
            size="sm"
            checked={enabled}
            onCheckedChange={setEnabled}
          />

          <div className="grid grid-cols-4 gap-3">
            <Input label="Connect ms" name="connectTimeoutMs" type="number" size="sm" defaultValue={server?.settings.connectTimeoutMs ?? 15000} required />
            <Input label="Request ms" name="requestTimeoutMs" type="number" size="sm" defaultValue={server?.settings.requestTimeoutMs ?? 60000} required />
            <Input label="Total ms" name="maxTotalTimeoutMs" type="number" size="sm" defaultValue={server?.settings.maxTotalTimeoutMs ?? 600000} required />
            <Input label="Concurrency" name="maxConcurrency" type="number" size="sm" min={1} defaultValue={server?.settings.maxConcurrency ?? 1} required />
          </div>

          {kind === 'home' && (
            <Select
              label="Restart policy"
              size="sm"
              value={restart}
              onValueChange={(v) => setRestart((v ?? 'on-failure') as Restart)}
              items={{ 'on-failure': 'On failure', always: 'Always', never: 'Never' }}
            />
          )}

          {error && <div className="text-xs text-kumo-danger">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Dialog.Close render={<Button variant="secondary" size="sm">取消</Button>} />
            <Button variant="primary" size="sm" type="submit" loading={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
}

function required(form: FormData, name: string): string {
  const value = form.get(name);
  if (value === null || String(value).trim() === '') throw new Error(`${name} 不能为空`);
  return String(value).trim();
}

function optional(form: FormData, name: string): string {
  const value = form.get(name);
  return value === null ? '' : String(value).trim();
}

function parseMap(value: string): Record<string, string> {
  if (value === '') return {};
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JSON 必须是对象');
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== 'string') throw new Error(`${k} 的值必须是字符串`);
    out[k] = v;
  }
  return out;
}
