import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { CopyButton } from '@/components/shared/CopyButton';
import { StatusLabel } from '@/components/shared/StatusDot';
import { api, errorMessage } from '@/lib/api';
import { serverEndpointSchema, type ServerStatus } from '@/lib/contracts';

export function ServerInspect({
  status,
  onOpenChange,
}: {
  status: ServerStatus | null;
  onOpenChange(open: boolean): void;
}) {
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEndpoint(null);
    setError(null);
    if (!status) return;
    api(`/api/v1/servers/${status.server.id}/endpoint`, serverEndpointSchema)
      .then((e) => setEndpoint(e.individualUrl))
      .catch((cause: unknown) => setError(errorMessage(cause)));
  }, [status]);

  if (!status) return null;
  const r = status.runtime;

  return (
    <Sheet open={status !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <StatusLabel status={r?.status ?? (status.server.enabled ? 'unknown' : 'disabled')} />
            {status.server.name}
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">/mcp/{status.server.slug}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
            <Field label="Runtime" value={r?.status ?? 'unknown'} />
            <Field label="Protocol" value={r?.protocolVersion ?? '未协商'} />
            <Field label="Era" value={r?.protocolEra ?? '—'} />
            <Field label="Restarts" value={String(r?.restartCount ?? 0)} />
            <Field label="PID" value={r?.processId ? String(r.processId) : '—'} />
            <Field label="Last success" value={r?.lastSuccessAt ?? '—'} />
          </div>

          {endpoint && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">独立 Endpoint</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted/40 px-2.5 py-1.5 font-mono text-xs">{endpoint}</code>
                <CopyButton value={endpoint} label="复制" />
              </div>
            </div>
          )}
          {error && <div className="text-xs text-red-400">{error}</div>}
          {r?.lastError && (
            <div className="rounded-md border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300">
              {r.lastError}
            </div>
          )}

          <Separator />

          <div>
            <span className="text-xs text-muted-foreground">capability snapshot</span>
            <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground">
              {JSON.stringify(status.snapshot ?? { status: 'snapshot unavailable' }, null, 2)}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-medium text-foreground">{value}</div>
    </div>
  );
}
