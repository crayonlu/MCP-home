import * as Tabs from '@radix-ui/react-tabs';
import { Activity, FileJson2, Link2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button.js';
import { CopyField } from '../components/ui/CopyField.js';
import { LoadError, Page } from '../components/ui/Page.js';
import { api, errorMessage } from '../lib/api.js';
import { endpointSchema, unknownRecordSchema } from '../lib/contracts.js';

export function DiagnosticsPage(): ReactNode {
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [report, endpointInfo] = await Promise.all([
        api('/api/v1/diagnostics', unknownRecordSchema),
        api('/api/v1/endpoints/aggregate', endpointSchema),
      ]);
      setDiagnostics(report);
      setEndpoint(endpointInfo.url);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Page
      eyebrow="Runtime diagnostics"
      title="一份状态，覆盖所有入口。"
      description="Web、CLI、Control API 与 MCP 数据面读取同一套运行时事实。"
      action={
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          刷新
        </Button>
      }
    >
      {error && <LoadError message={error} onRetry={load} />}
      <Tabs.Root className="tabs" defaultValue="report">
        <Tabs.List className="tabs-list">
          <Tabs.Trigger value="report">
            <Activity size={15} />
            System report
          </Tabs.Trigger>
          <Tabs.Trigger value="endpoints">
            <Link2 size={15} />
            Endpoints
          </Tabs.Trigger>
          <Tabs.Trigger value="openapi">
            <FileJson2 size={15} />
            OpenAPI
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="report" className="tab-panel">
          <div className="code-panel">
            <div className="code-panel-head">
              <span>diagnostics.json</span>
              <span>{loading ? 'Refreshing' : 'Live state'}</span>
            </div>
            <pre>{JSON.stringify(diagnostics ?? { status: 'loading' }, null, 2)}</pre>
          </div>
        </Tabs.Content>
        <Tabs.Content value="endpoints" className="tab-panel">
          <section className="settings-block">
            <span className="section-index">Aggregate MCP</span>
            <h2>标准 Streamable HTTP 入口</h2>
            <p>使用 MCP Access API Key 或 MCP Home OAuth access token。</p>
            {endpoint && <CopyField value={endpoint} />}
          </section>
          <section className="settings-block">
            <span className="section-index">Health probes</span>
            <div className="probe-grid">
              <CopyField value={`${location.origin}/healthz`} />
              <CopyField value={`${location.origin}/readyz`} />
            </div>
          </section>
        </Tabs.Content>
        <Tabs.Content value="openapi" className="tab-panel">
          <section className="settings-block">
            <span className="section-index">Control API</span>
            <h2>OpenAPI 3.1 document</h2>
            <p>CLI 暴露完整控制能力；其他 Agent 也可以直接依据这份文档调用。</p>
            <CopyField value={`${location.origin}/api/v1/openapi.json`} openable />
          </section>
        </Tabs.Content>
      </Tabs.Root>
    </Page>
  );
}
