import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { MoreHorizontal, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { SecretReveal } from '@/components/shared/SecretReveal';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { api, apiVoid, errorMessage } from '@/lib/api';
import { apiKeyRecordSchema, issuedKeySchema, type ApiKeyRecord } from '@/lib/contracts';
import { useResource } from '@/lib/hooks';
import { relativeDate } from '@/lib/format';

type Kind = 'access' | 'control';

export function KeysPage() {
  const [kind, setKind] = useState<Kind>('access');
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyRecord | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const list = useResource(`/api/v1/${kind}-keys`, apiKeyRecordSchema.array());

  const reload = () => list.reload();

  return (
    <>
      <PageHeader title={kind === 'access' ? 'Access Keys' : 'Control Keys'}>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {(['access', 'control'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                'rounded px-2.5 py-1 text-xs transition-colors',
                kind === k
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {k === 'access' ? 'Access' : 'Control'}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          新建
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6">
        {list.error ? (
          <div className="text-sm text-red-400">{list.error}</div>
        ) : list.loading && !list.data ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState
            title={`还没有 ${kind === 'access' ? 'Access' : 'Control'} Key`}
            hint={kind === 'access' ? 'Access Key 供 Harness 连接 /mcp 端点。' : 'Control Key 用于登录控制台。'}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">名称</th>
                  <th className="px-4 py-2 font-medium">前缀</th>
                  <th className="px-4 py-2 font-medium">创建</th>
                  <th className="px-4 py-2 font-medium">最近使用</th>
                  <th className="px-4 py-2 font-medium">状态</th>
                  <th className="w-8 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.data.map((key) => (
                  <tr key={key.id}>
                    <td className="px-4 py-2.5 font-medium">{key.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{key.prefix}…</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{relativeDate(key.createdAt)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{relativeDate(key.lastUsedAt)}</td>
                    <td className="px-4 py-2.5">
                      {key.revokedAt ? (
                        <Badge variant="outline" className="text-muted-foreground">已撤销</Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-400/30 text-emerald-300">活跃</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!key.revokedAt && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-xs" aria-label="操作">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-300"
                              onSelect={() => setRevoking(key)}
                            >
                              撤销
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateKeySheet
        kind={kind}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(s) => {
          setSecret(s);
          reload();
        }}
      />

      <SecretReveal
        open={secret !== null}
        onOpenChange={(o) => !o && setSecret(null)}
        secret={secret}
        label={kind === 'access' ? 'Access Key' : 'Control Key'}
      />

      <AlertDialog open={revoking !== null} onOpenChange={(o) => !o && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤销此 Key?</AlertDialogTitle>
            <AlertDialogDescription>
              撤销后该 Key 立即失效,且无法恢复。{revoking?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!revoking) return;
                try {
                  await apiVoid(`/api/v1/${kind}-keys/${revoking.id}`, { method: 'DELETE' });
                  toast.success('已撤销');
                  setRevoking(null);
                  reload();
                } catch (cause) {
                  toast.error('撤销失败', { description: errorMessage(cause) });
                }
              }}
            >
              撤销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateKeySheet({
  kind,
  open,
  onOpenChange,
  onCreated,
}: {
  kind: Kind;
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated(secret: string): void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api(`/api/v1/${kind}-keys`, issuedKeySchema, {
        method: 'POST',
        body: { name: name.trim() },
      });
      onCreated(res.secret);
      setName('');
      onOpenChange(false);
    } catch (cause) {
      toast.error('创建失败', { description: errorMessage(cause) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>新建 {kind === 'access' ? 'Access' : 'Control'} Key</SheetTitle>
          <SheetDescription>为这把 Key 命名,便于后续识别。</SheetDescription>
        </SheetHeader>
        <form onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col gap-4 px-4">
          <div className="space-y-1.5 pt-2">
            <Label htmlFor="key-name">名称</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="laptop · ci · ci-prod"
              autoFocus
              required
            />
          </div>
          <SheetFooter className="mt-auto">
            <Button type="submit" disabled={saving}>
              {saving ? '创建中…' : '创建'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
