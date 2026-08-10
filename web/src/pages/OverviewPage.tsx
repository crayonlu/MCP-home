import { ArrowRight } from '@phosphor-icons/react';
import { Badge, Button } from '@cloudflare/kumo';
import { PageHeader } from '@/components/layout/PageHeader';
import { CopyField } from '@/components/shared/CopyButton';
import { StatusLabel } from '@/components/shared/StatusDot';
import { useResource, type Route } from '@/lib/hooks';
import {
  diagnosticsSchema,
  endpointSchema,
  eventRecordSchema,
  overviewSchema,
} from '@/lib/contracts';
import { relativeDate } from '@/lib/format';

const LEVEL_VARIANT: Record<string, 'error' | 'warning' | 'success' | 'neutral'> = {
  error: 'error',
  warn: 'warning',
  info: 'success',
  debug: 'neutral',
};

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
      <div className="flex-1 space-y-4 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stats.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-kumo-line bg-kumo-base px-3 py-2"
            >
              <div className="text-xl font-semibold tabular-nums text-kumo-strong">{m.value}</div>
              <div className="text-xs text-kumo-subtle">{m.label}</div>
            </div>
          ))}
        </div>

        <section className="rounded-lg border border-kumo-line bg-kumo-base p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium text-kumo-subtle">聚合 Endpoint</h2>
            <StatusLabel status={diag.data?.ok ? 'ready' : 'degraded'} />
          </div>
          {endpoint.data ? (
            <CopyField value={endpoint.data.url} />
          ) : (
            <div className="h-8 animate-pulse rounded bg-kumo-tint" />
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium text-kumo-subtle">最近事件</h2>
            <Button variant="ghost" size="xs" onClick={() => onNavigate('logs')}>
              全部 <ArrowRight size={14} />
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border border-kumo-line bg-kumo-base">
            {events.data && events.data.length > 0 ? (
              events.data.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 border-b border-kumo-line px-3 py-1.5 text-xs last:border-0"
                >
                  <Badge variant={LEVEL_VARIANT[e.level] ?? 'neutral'} className="text-[10px]">
                    {e.level}
                  </Badge>
                  <span className="w-24 shrink-0 truncate font-mono text-kumo-subtle">{e.type}</span>
                  <span className="flex-1 truncate text-kumo-default">{e.message}</span>
                  <span className="shrink-0 tabular-nums text-kumo-subtle">
                    {relativeDate(e.createdAt)}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-xs text-kumo-subtle">暂无事件</div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
