import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useResource } from '@/lib/hooks';
import { eventRecordSchema } from '@/lib/contracts';
import { relativeDate } from '@/lib/format';

const LEVEL_TONE: Record<string, string> = {
  error: 'bg-red-400 text-red-300 border-red-400/30',
  warn: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  info: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  debug: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
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
        <Button variant="outline" size="xs" onClick={reload} disabled={loading}>
          <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </PageHeader>
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="p-4 text-sm text-red-400">加载失败:{error}</div>
        )}
        <div className="divide-y divide-border font-mono text-xs">
          {data?.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-4 py-2">
              <span className="shrink-0 tabular-nums text-muted-foreground">{relativeDate(e.createdAt)}</span>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase ${LEVEL_TONE[e.level] ?? LEVEL_TONE.debug}`}
              >
                {e.level}
              </span>
              <span className="w-40 shrink-0 truncate text-muted-foreground">{e.type}</span>
              <span className="flex-1 break-all text-foreground">{e.message}</span>
            </div>
          ))}
          {loading && (!data || data.length === 0) && (
            <div className="px-4 py-8 text-center text-muted-foreground">加载中…</div>
          )}
          {data && data.length === 0 && !loading && (
            <div className="px-4 py-12 text-center text-muted-foreground">暂无事件</div>
          )}
        </div>
      </div>
    </>
  );
}
