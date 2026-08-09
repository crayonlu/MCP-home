import { ArrowRight, KeyRound, Waypoints } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { login } from '../lib/api.js';
import { Button } from './ui/Button.js';

export function LoginScreen({ onSuccess }: { onSuccess(): void }): ReactNode {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(key);
      setKey('');
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      <section className="login-context">
        <div className="login-brand">
          <Waypoints size={21} strokeWidth={1.7} />
          <span>MCP Home</span>
        </div>
        <div>
          <span className="eyebrow">Private control plane</span>
          <h1>一个入口，安放你所有的 MCP。</h1>
          <p>上游凭据留在 Home 内；Harness 只接触标准 MCP URL 与独立的 Access Key。</p>
        </div>
        <small>Self-hosted · Single-user · Protocol-native</small>
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <span className="login-icon">
            <KeyRound size={20} strokeWidth={1.7} />
          </span>
          <div>
            <h2>进入控制台</h2>
            <p>使用 Control API Key 建立短期管理会话。</p>
          </div>
          <label className="field">
            <span>Control API Key</span>
            <input
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="mch_ctl_..."
              autoComplete="current-password"
              autoFocus
              required
            />
          </label>
          {error && <div className="inline-error">{error}</div>}
          <Button type="submit" disabled={loading}>
            <span>{loading ? '正在验证' : '进入 MCP Home'}</span>
            <ArrowRight size={16} strokeWidth={1.8} />
          </Button>
        </form>
      </section>
    </div>
  );
}
