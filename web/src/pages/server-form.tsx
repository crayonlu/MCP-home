import { useState, type FormEvent } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, errorMessage } from '@/lib/api';
import { serverRecordSchema, type CredentialRecord, type ServerRecord } from '@/lib/contracts';

type Kind = 'remote' | 'home';
type ProtocolMode = 'auto' | 'legacy' | 'modern';
type Restart = 'never' | 'on-failure' | 'always';

export function ServerFormSheet({
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

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const transport =
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
        transport,
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

  const transport = server?.transport;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? '编辑 Server' : '添加 Server'}</SheetTitle>
          <SheetDescription>{editing ? server!.name : '配置上游 MCP Server'}</SheetDescription>
        </SheetHeader>

        <form onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col gap-4 px-4">
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Field label="名称">
              <Input name="name" defaultValue={server?.name} placeholder="GitHub" required />
            </Field>
            <Field label="Slug">
              <Input
                name="slug"
                defaultValue={server?.slug}
                placeholder="github"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                disabled={editing}
                required
              />
            </Field>
          </div>

          {!editing && (
            <Field label="运行位置">
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">Remote-native</SelectItem>
                  <SelectItem value="home">Home-hosted</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {kind === 'remote' && (
            <Field label="Streamable HTTP URL">
              <Input
                name="url"
                type="url"
                defaultValue={transport?.type === 'streamable-http' ? transport.url : ''}
                placeholder="https://mcp.example.com/mcp"
                required
              />
            </Field>
          )}
          {kind === 'remote' && (
            <Field label="静态 Headers (JSON)">
              <Textarea
                name="headers"
                rows={2}
                defaultValue={
                  transport?.type === 'streamable-http' ? JSON.stringify(transport.headers, null, 2) : '{}'
                }
                className="font-mono text-xs"
              />
            </Field>
          )}
          {kind === 'home' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Command">
                <Input
                  name="command"
                  defaultValue={transport?.type === 'stdio' ? transport.command : ''}
                  placeholder="npx"
                  required
                />
              </Field>
              <Field label="Working dir">
                <Input
                  name="cwd"
                  defaultValue={transport?.type === 'stdio' ? transport.cwd : ''}
                  placeholder="可选"
                />
              </Field>
              <div className="col-span-2">
                <Field label="Arguments (每行一个)">
                  <Textarea
                    name="args"
                    rows={3}
                    defaultValue={transport?.type === 'stdio' ? transport.args.join('\n') : ''}
                    className="font-mono text-xs"
                  />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Environment (JSON)">
                  <Textarea
                    name="env"
                    rows={3}
                    defaultValue={transport?.type === 'stdio' ? JSON.stringify(transport.env, null, 2) : '{}'}
                    className="font-mono text-xs"
                  />
                </Field>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="协议协商">
              <Select value={protocolMode} onValueChange={(v) => setProtocolMode(v as ProtocolMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="legacy">Legacy</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="上游 Credential">
              <Select value={credentialId} onValueChange={setCredentialId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无</SelectItem>
                  {compatible.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} · {c.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <div className="text-sm">启用</div>
              <div className="text-xs text-muted-foreground">允许 Harness 访问</div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          {kind === 'remote' && (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <div className="text-sm">SSE fallback</div>
                <div className="text-xs text-muted-foreground">Streamable HTTP 失败后回退</div>
              </div>
              <Switch checked={sseFallback} onCheckedChange={setSseFallback} />
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <Field label="Connect ms">
              <Input name="connectTimeoutMs" type="number" defaultValue={server?.settings.connectTimeoutMs ?? 15000} required />
            </Field>
            <Field label="Request ms">
              <Input name="requestTimeoutMs" type="number" defaultValue={server?.settings.requestTimeoutMs ?? 60000} required />
            </Field>
            <Field label="Total ms">
              <Input name="maxTotalTimeoutMs" type="number" defaultValue={server?.settings.maxTotalTimeoutMs ?? 600000} required />
            </Field>
            <Field label="Concurrency">
              <Input name="maxConcurrency" type="number" min={1} defaultValue={server?.settings.maxConcurrency ?? 1} required />
            </Field>
          </div>

          {kind === 'home' && (
            <Field label="Restart policy">
              <Select value={restart} onValueChange={(v) => setRestart(v as Restart)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on-failure">On failure</SelectItem>
                  <SelectItem value="always">Always</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {error && <div className="text-xs text-red-400">{error}</div>}

          <SheetFooter className="mt-auto">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  );
}

const labelCls = 'text-xs font-medium text-muted-foreground';

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
  const obj = parsed as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== 'string') throw new Error(`${k} 的值必须是字符串`);
    out[k] = v;
  }
  return out;
}
