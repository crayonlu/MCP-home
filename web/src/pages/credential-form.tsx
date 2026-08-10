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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, errorMessage } from '@/lib/api';
import { credentialRecordSchema, type CredentialRecord } from '@/lib/contracts';

type CType = 'bearer' | 'api-key' | 'headers' | 'env' | 'oauth';

export function CredentialFormSheet({
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? '编辑 Credential' : '添加 Credential'}</SheetTitle>
          <SheetDescription>{editing ? credential!.name : '上游认证凭据'}</SheetDescription>
        </SheetHeader>
        <form onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col gap-4 px-4">
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1.5">
              <Label>名称</Label>
              <Input name="name" defaultValue={credential?.name} placeholder="GitHub token" required />
            </div>
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select value={type} onValueChange={(v) => setType(v as CType)} disabled={editing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bearer">Bearer</SelectItem>
                  <SelectItem value="api-key">API Key</SelectItem>
                  <SelectItem value="headers">Headers</SelectItem>
                  <SelectItem value="env">Environment</SelectItem>
                  <SelectItem value="oauth">OAuth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <PayloadFields type={type} credential={credential} />

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

function PayloadFields({ type, credential }: { type: CType; credential: CredentialRecord | null }) {
  if (type === 'bearer') {
    return (
      <div className="space-y-1.5">
        <Label>Token</Label>
        <Input name="token" defaultValue={secretField(credential, 'token')} className="font-mono text-xs" required />
      </div>
    );
  }
  if (type === 'api-key') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Header name</Label>
          <Input name="headerName" defaultValue={secretField(credential, 'headerName')} placeholder="X-API-Key" required />
        </div>
        <div className="space-y-1.5">
          <Label>Value</Label>
          <Input name="value" defaultValue={secretField(credential, 'value')} className="font-mono text-xs" required />
        </div>
      </div>
    );
  }
  if (type === 'headers') {
    return (
      <div className="space-y-1.5">
        <Label>Headers (JSON)</Label>
        <Textarea name="headers" rows={4} defaultValue={secretField(credential, 'headers')} className="font-mono text-xs" />
      </div>
    );
  }
  if (type === 'env') {
    return (
      <div className="space-y-1.5">
        <Label>Variables (JSON)</Label>
        <Textarea name="variables" rows={4} defaultValue={secretField(credential, 'variables')} className="font-mono text-xs" />
      </div>
    );
  }
  // oauth
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label>Issuer</Label>
        <Input name="issuer" defaultValue={secretField(credential, 'issuer')} className="font-mono text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label>Scope</Label>
        <Input name="scope" defaultValue={secretField(credential, 'scope')} className="font-mono text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label>Client ID</Label>
        <Input name="clientId" defaultValue={secretField(credential, 'clientId')} className="font-mono text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label>Client secret</Label>
        <Input name="clientSecret" defaultValue={secretField(credential, 'clientSecret')} className="font-mono text-xs" />
      </div>
    </div>
  );
}

function secretField(_credential: CredentialRecord | null, _name: string): string {
  // Secrets are never returned by the API; editing re-enters values.
  return '';
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
