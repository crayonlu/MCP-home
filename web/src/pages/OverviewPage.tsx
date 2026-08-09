import {
  ArrowUpRight,
  Boxes,
  CircleGauge,
  KeyRound,
  Server,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button.js';
import { CopyField } from '../components/ui/CopyField.js';
import { LoadError, Page } from '../components/ui/Page.js';
import { api, errorMessage } from '../lib/api.js';
import { overviewSchema, type Overview, type View } from '../lib/contracts.js';

export function OverviewPage({ onNavigate }: { onNavigate(view: View): void }): ReactNode {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOverview(await api('/api/v1/overview', overviewSchema));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Page
      eyebrow="System overview"
      title="你的 MCP，状态清晰，入口稳定。"
      description="管理上游连接、凭据与对外访问，不改变 Harness 的标准 MCP 接入方式。"
      action={
        <Button onClick={() => onNavigate('servers')}>
          <Server size={16} strokeWidth={1.8} />
          管理 Servers
        </Button>
      }
    >
      {error && <LoadError message={error} onRetry={load} />}
      <div className="metric-grid">
        <Metric
          icon={Boxes}
          label="MCP Servers"
          value={overview?.servers.total ?? '—'}
          detail={overview ? `${overview.servers.enabled} enabled` : 'Loading'}
        />
        <Metric
          icon={CircleGauge}
          label="Runtime"
          value={overview?.servers.ready ?? '—'}
          detail={overview ? `${overview.servers.unhealthy} need attention` : 'Loading'}
        />
        <Metric
          icon={ShieldCheck}
          label="Credentials"
          value={overview?.credentials ?? '—'}
          detail="Encrypted at rest"
        />
        <Metric icon={KeyRound} label="Boundary" value="2 keys" detail="Control / Access" />
      </div>

      <section className="endpoint-feature">
        <div className="endpoint-copy">
          <span className="section-index">01 / Aggregate endpoint</span>
          <h2>Harness 只配置一次。</h2>
          <p>
            聚合入口自动命名空间化所有能力；需要原始名称与扩展语义时，使用对应 Server 的独立入口。
          </p>
        </div>
        <div className="endpoint-value">
          <span>Streamable HTTP</span>
          {overview ? (
            <CopyField value={overview.endpoints.aggregate} />
          ) : (
            <div className="skeleton-line" />
          )}
        </div>
      </section>

      <div className="principle-grid">
        <Principle
          index="02"
          title="凭据不出 Home"
          description="OAuth、OIDC、API Key 与自定义 Header 在本地加密保存，Harness 永远看不到上游 Secret。"
          action={
            <Button variant="quiet" onClick={() => onNavigate('credentials')}>
              查看 Credentials <ArrowUpRight size={15} />
            </Button>
          }
        />
        <Principle
          index="03"
          title="协议能力不打折"
          description="Tools、Resources、Prompts、Completion、Subscriptions、MRTR、Tasks 与 MCP Apps 都走协议桥接。"
          action={
            <Button variant="quiet" onClick={() => onNavigate('diagnostics')}>
              查看 Diagnostics <ArrowUpRight size={15} />
            </Button>
          }
        />
      </div>
    </Page>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
}): ReactNode {
  return (
    <article className="metric-card">
      <div className="metric-label">
        <Icon size={16} strokeWidth={1.7} />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Principle({
  index,
  title,
  description,
  action,
}: {
  index: string;
  title: string;
  description: string;
  action: ReactNode;
}): ReactNode {
  return (
    <article className="principle-card">
      <span className="section-index">{index}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </article>
  );
}
