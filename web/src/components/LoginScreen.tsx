import { PlugsConnected } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { Button, Input } from '@cloudflare/kumo';
import { login } from '@/lib/api';
import { useToast } from '@/lib/hooks';

export function LoginScreen({ onSuccess }: { onSuccess(): void }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    try {
      await login(key.trim());
      onSuccess();
    } catch {
      toast.error('Control API Key 无效');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-sm space-y-4 rounded-xl border border-kumo-line bg-kumo-base p-6"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <PlugsConnected className="size-7 text-kumo-strong" />
          <h1 className="text-base font-semibold text-kumo-strong">MCP Home</h1>
          <p className="text-xs text-kumo-subtle">输入 Control API Key 进入控制台</p>
        </div>
        <Input
          label="Control API Key"
          type="password"
          autoComplete="current-password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="mch_ctl_…"
          autoFocus
          required
        />
        <Button variant="primary" type="submit" loading={loading} className="w-full">
          {loading ? '验证中…' : '登录'}
        </Button>
      </form>
    </div>
  );
}
