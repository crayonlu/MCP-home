import { useEffect, useState } from 'react';
import { ClipboardText, Dialog } from '@cloudflare/kumo';
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
    <Dialog.Root open={status !== null} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="max-h-[85vh] overflow-y-auto p-6">
        <div className="mb-1 flex items-center gap-2">
          <StatusLabel status={r?.status ?? (status.server.enabled ? 'unknown' : 'disabled')} />
          <Dialog.Title className="text-base font-semibold">{status.server.name}</Dialog.Title>
        </div>
        <Dialog.Description className="font-mono text-xs">/mcp/{status.server.slug}</Dialog.Description>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <Field label="Protocol" value={r?.protocolVersion ?? '未协商'} />
          <Field label="Era" value={r?.protocolEra ?? '—'} />
          <Field label="Restarts" value={String(r?.restartCount ?? 0)} />
          <Field label="PID" value={r?.processId ? String(r.processId) : '—'} />
          <Field label="Last success" value={r?.lastSuccessAt ?? '—'} />
        </div>

        {endpoint && (
          <div className="mt-4 space-y-1.5">
            <span className="text-xs text-kumo-subtle">独立 Endpoint</span>
            <ClipboardText text={endpoint} size="sm" />
          </div>
        )}
        {error && <div className="mt-2 text-xs text-kumo-danger">{error}</div>}
        {r?.lastError && (
          <div className="mt-2 rounded-md border border-kumo-danger/40 bg-kumo-danger-tint p-3 text-xs text-kumo-danger">
            {r.lastError}
          </div>
        )}

        <div className="my-4 h-px bg-kumo-line" />

        <div>
          <span className="text-xs text-kumo-subtle">capability snapshot</span>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-kumo-recessed p-3 font-mono text-xs leading-relaxed text-kumo-default">
            {JSON.stringify(status.snapshot ?? { status: 'snapshot unavailable' }, null, 2)}
          </pre>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-kumo-subtle">{label}</div>
      <div className="truncate font-medium text-kumo-default">{value}</div>
    </div>
  );
}
