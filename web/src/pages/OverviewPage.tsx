import { ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { CopyButton } from '@/components/shared/CopyButton';
import { StatusLabel } from '@/components/shared/StatusDot';
import { useResource, type Route } from '@/lib/hooks';
import {
  diagnosticsSchema,
  endpointSchema,
  eventRecordSchema,
  overviewSchema,
} from '@/lib/contracts';
import { relativeDate } from '@/lib/format';

export function OverviewPage({ onNavigate }: { onNavigate(route: Route): void }) {
  const overview = useResource('/api/v1/overview', overviewSchema);
  const endpoint = useResource('/api/v1/endpoints/aggregate', endpointSchema);
  const diag = useResource('/api/v1/diagnostics', diagnosticsSchema, { pollMs: 60000 });
  const events = useResource('/api/v1/events?limit=8', eventRecordSchema.array(), {
    pollMs: 8000,
  });

  const s = overview.data?.servers;
  const stats = [
    { label: 'Servers', value: s?.total ?? '—' },
    { label: 'Enabled', value: s?.enabled ?? '—' },
    { label: 'Ready', value: s?.ready ?? '—' },
    { label: 'Unhealthy', value: s?.unhealthy ?? '—' },
    { label: 'Credentials', value: overview.data?.credentials ?? '—' },
  ];

  return (
    <>
      <PageHeader title="Overview" />
      <div className="flex-1 space-y-6 overflow-auto p-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="text-2xl font-semibold tracking-tight tabular-nums">{m.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium text-muted-foreground">聚合 Endpoint</h2>
            <StatusLabel status={diag.data?.ok ? 'ready' : 'degraded'} />
          </div>
          {endpoint.data ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-muted/40 px-2.5 py-1.5 font-mono text-xs text-foreground">
                {endpoint.data.url}
              </code>
              <CopyButton value={endpoint.data.url} label="复制 URL" />
            </div>
          ) : (
            <div className="h-8 animate-pulse rounded-md bg-muted/40" />
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium text-muted-foreground">最近事件</h2>
            <button
              onClick={() => onNavigate('logs')}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              全部 <ArrowRight className="size-3" />
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {events.data && events.data.length > 0 ? (
              events.data.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs last:border-0"
                >
                  <LevelDot level={e.level} />
                  <span className="w-24 shrink-0 truncate font-mono text-muted-foreground">{e.type}</span>
                  <span className="flex-1 truncate text-foreground">{e.message}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{relativeDate(e.createdAt)}</span>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">暂无事件</div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function LevelDot({ level }: { level: string }) {
  const cls =
    level === 'error'
      ? 'bg-red-400'
      : level === 'warn'
        ? 'bg-amber-400'
        : level === 'info'
          ? 'bg-emerald-400'
          : 'bg-zinc-500';
  return <span className={`inline-block size-1.5 shrink-0 rounded-full ${cls}`} />;
}
