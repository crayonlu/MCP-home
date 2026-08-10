import { useState, type FormEvent } from 'react';
import { Button, Dialog, Input, InputArea, Select } from '@cloudflare/kumo';
import { api, errorMessage } from '@/lib/api';
import { credentialRecordSchema, type CredentialRecord } from '@/lib/contracts';

type CType = 'bearer' | 'api-key' | 'headers' | 'env' | 'oauth';

export function CredentialFormDialog({
  open,
  onOpenChange,
  credential,
  onSaved,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  credential: CredentialRecord | null;
  onSaved(c: CredentialRecord): void | Promise<void>;
}) {
  const editing = credential !== null;
  const [type, setType] = useState<CType>(credential?.type ?? 'bearer');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const name = String(form.get('name') ?? '').trim();
      if (!name) throw new Error('名称不能为空');
      const payload = buildPayload(type, form);
      const saved = editing
        ? await api(`/api/v1/credentials/${credential!.id}`, credentialRecordSchema, {
            method: 'PATCH',
            body: { name, payload },
          })
        : await api('/api/v1/credentials', credentialRecordSchema, {
            method: 'POST',
            body: { name, payload },
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
      <Dialog size="lg" className="max-h-[88vh] overflow-y-auto p-6">
        <Dialog.Title className="mb-1 text-base font-semibold">
          {editing ? '编辑 Credential' : '添加 Credential'}
        </Dialog.Title>
        <Dialog.Description className="text-kumo-subtle">
          {editing ? credential!.name : '上游认证凭据'}
        </Dialog.Description>

        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="名称" name="name" size="sm" defaultValue={credential?.name} placeholder="GitHub token" required />
            <Select
              label="类型"
              size="sm"
              value={type}
              onValueChange={(v) => setType((v ?? 'bearer') as CType)}
              disabled={editing}
              items={{
                bearer: 'Bearer',
                'api-key': 'API Key',
                headers: 'Headers',
                env: 'Environment',
                oauth: 'OAuth',
              }}
            />
          </div>

          {type === 'bearer' && (
            <Input label="Token" name="token" size="sm" placeholder="ghp_…" required />
          )}
          {type === 'api-key' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Header name" name="headerName" size="sm" placeholder="X-API-Key" required />
              <Input label="Value" name="value" size="sm" required />
            </div>
          )}
          {type === 'headers' && (
            <InputArea label="Headers (JSON)" name="headers" size="sm" rows={4} defaultValue="{}" />
          )}
          {type === 'env' && (
            <InputArea label="Variables (JSON)" name="variables" size="sm" rows={4} defaultValue="{}" />
          )}
          {type === 'oauth' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Issuer" name="issuer" size="sm" placeholder="https://…" />
              <Input label="Scope" name="scope" size="sm" />
              <Input label="Client ID" name="clientId" size="sm" />
              <Input label="Client secret" name="clientSecret" size="sm" />
            </div>
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

function buildPayload(type: CType, form: FormData): Record<string, unknown> {
  const str = (name: string): string => String(form.get(name) ?? '').trim();
  const json = (name: string): Record<string, string> => {
    const raw = str(name);
    if (raw === '') return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${name} 必须是 JSON 对象`);
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== 'string') throw new Error(`${k} 的值必须是字符串`);
      out[k] = v;
    }
    return out;
  };
  switch (type) {
    case 'bearer':
      return { type, token: str('token') };
    case 'api-key':
      return { type, headerName: str('headerName'), value: str('value') };
    case 'headers':
      return { type, headers: json('headers') };
    case 'env':
      return { type, variables: json('variables') };
    case 'oauth': {
      const payload: Record<string, unknown> = { type, tokenType: 'Bearer' };
      for (const k of ['issuer', 'scope', 'clientId', 'clientSecret']) {
        if (str(k)) payload[k] = str(k);
      }
      return payload;
    }
  }
}
