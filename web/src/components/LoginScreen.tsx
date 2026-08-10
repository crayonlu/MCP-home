import { useState, type FormEvent } from 'react';
import { Waypoints } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/lib/api';

export function LoginScreen({ onSuccess }: { onSuccess(): void }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="flex min-h-screen w-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <Waypoints className="size-7 text-foreground" strokeWidth={1.6} />
          <h1 className="text-base font-semibold">MCP Home</h1>
          <p className="text-xs text-muted-foreground">输入 Control API Key 进入控制台</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="key">Control API Key</Label>
          <Input
            id="key"
            type="password"
            autoComplete="current-password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="mch_ctl_…"
            autoFocus
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '验证中…' : '登录'}
        </Button>
      </form>
    </div>
  );
}
