import { ArrowClockwise } from '@phosphor-icons/react';
import { Badge, Button } from '@cloudflare/kumo';
import { PageHeader } from '@/components/layout/PageHeader';
import { useResource } from '@/lib/hooks';
import { eventRecordSchema } from '@/lib/contracts';
import { relativeDate } from '@/lib/format';

const LEVEL_VARIANT: Record<string, 'error' | 'warning' | 'success' | 'neutral'> = {
  error: 'error',
  warn: 'warning',
  info: 'success',
  debug: 'neutral',
};

export function LogsPage() {
  const { data, loading, error, reload } = useResource(
    '/api/v1/events?limit=200',
    eventRecordSchema.array(),
    { pollMs: 5000 },
  );

  return (
    <>
      <PageHeader title="Logs">
        <Button variant="outline" size="xs" onClick={reload} loading={loading}>
          <ArrowClockwise size={14} /> 刷新
        </Button>
      </PageHeader>
      <div className="flex-1 overflow-auto">
        {error && <div className="p-4 text-sm text-kumo-danger">加载失败:{error}</div>}
        <div className="divide-y divide-kumo-line font-mono text-xs">
          {data?.map((e) => (
            <div key={e.id} className="flex items-start gap-2 px-4 py-1.5">
              <span className="shrink-0 tabular-nums text-kumo-subtle">
                {relativeDate(e.createdAt)}
              </span>
              <Badge variant={LEVEL_VARIANT[e.level] ?? 'neutral'} className="shrink-0 text-[10px]">
                {e.level}
              </Badge>
              <span className="w-40 shrink-0 truncate text-kumo-subtle">{e.type}</span>
              <span className="flex-1 break-all text-kumo-default">{e.message}</span>
            </div>
          ))}
          {loading && (!data || data.length === 0) && (
            <div className="px-4 py-8 text-center text-kumo-subtle">加载中…</div>
          )}
          {data && data.length === 0 && !loading && (
            <div className="px-4 py-12 text-center text-kumo-subtle">暂无事件</div>
          )}
        </div>
      </div>
    </>
  );
}
