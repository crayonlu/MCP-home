import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, MoreHorizontal, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusDot } from '@/components/shared/StatusDot';
import { api, apiVoid, errorMessage } from '@/lib/api';
import {
  authorizationResultSchema,
  credentialRecordSchema,
  type CredentialRecord,
} from '@/lib/contracts';
import { useResource } from '@/lib/hooks';
import { relativeDate } from '@/lib/format';
import { z } from 'zod';
import { CredentialFormSheet } from './credential-form';

const testSchema = z.object({ valid: z.boolean() }).passthrough();

export function CredentialsPage() {
  const list = useResource('/api/v1/credentials', credentialRecordSchema.array());
  const [editing, setEditing] = useState<CredentialRecord | null | 'new'>(null);
  const [deleting, setDeleting] = useState<CredentialRecord | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const reload = list.reload;

  const pollUntilSettled = useCallback(
    (id: string) => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      let ticks = 0;
      pollRef.current = window.setInterval(async () => {
        ticks += 1;
        try {
          const c = await api(`/api/v1/credentials/${id}`, credentialRecordSchema);
          if (c.status !== 'pending' || ticks > 40) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
            reload();
            toast.success(`${c.name} · ${c.status}`);
          }
        } catch {
          /* keep polling */
        }
      }, 2500);
    },
    [reload],
  );

  const runAction = async (c: CredentialRecord, action: string, label: string) => {
    try {
      await apiVoid(`/api/v1/credentials/${c.id}/${action}`, { method: 'POST' });
      toast.success(`${c.name} · ${label}`);
      reload();
    } catch (cause) {
      toast.error(`${c.name} 操作失败`, { description: errorMessage(cause) });
    }
  };

  const authorize = async (c: CredentialRecord) => {
    try {
      const res = await api(`/api/v1/credentials/${c.id}/authorize`, authorizationResultSchema, {
        method: 'POST',
      });
      if (res.status === 'authorization-required' && res.authorizationUrl) {
        window.open(res.authorizationUrl, '_blank', 'noopener,width=520,height=680');
        toast.message(`${c.name} · 请在弹窗中完成授权`);
        pollUntilSettled(c.id);
      } else {
        toast.success(`${c.name} · 已授权`);
        reload();
      }
    } catch (cause) {
      toast.error('授权失败', { description: errorMessage(cause) });
    }
  };

  const test = async (c: CredentialRecord) => {
    try {
      const res = await api(`/api/v1/credentials/${c.id}/test`, testSchema, { method: 'POST' });
      toast[res.valid ? 'success' : 'error'](`${c.name} · ${res.valid ? '验证通过' : '验证失败'}`);
    } catch (cause) {
      toast.error(`${c.name} 验证失败`, { description: errorMessage(cause) });
    }
  };

  return (
    <>
      <PageHeader title="Credentials">
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="size-4" />
          添加
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6">
        {list.error ? (
          <div className="text-sm text-red-400">{list.error}</div>
        ) : list.loading && !list.data ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState
            title="还没有 Credential"
            hint="为上游 MCP Server 创建 Bearer / API Key / OAuth 凭据。"
            action={
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus className="size-4" /> 添加 Credential
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="w-6 px-4 py-2" />
                  <th className="px-4 py-2 font-medium">名称</th>
                  <th className="px-4 py-2 font-medium">类型</th>
                  <th className="px-4 py-2 font-medium">状态</th>
                  <th className="px-4 py-2 font-medium">过期</th>
                  <th className="w-8 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.data.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5"><StatusDot status={c.status} /></td>
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">{c.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.status}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {c.expiresAt ? relativeDate(c.expiresAt) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-xs" aria-label="操作">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onSelect={() => void test(c)}>
                            <RefreshCw className="size-4" /> 验证
                          </DropdownMenuItem>
                          {c.type === 'oauth' && (
                            <DropdownMenuItem onSelect={() => void authorize(c)}>
                              <KeyRound className="size-4" /> 授权
                            </DropdownMenuItem>
                          )}
                          {c.type === 'oauth' && c.status !== 'ready' && (
                            <DropdownMenuItem
                              className="text-amber-300 focus:text-amber-200"
                              onSelect={() => void runAction(c, 'revoke', '已撤销')}
                            >
                              <RefreshCw className="size-4" /> 撤销
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => setEditing(c)}>
                            <MoreHorizontal className="size-4" /> 编辑
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-300"
                            onSelect={() => setDeleting(c)}
                          >
                            <Trash2 className="size-4" /> 删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CredentialFormSheet
        key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
        open={editing !== null}
        credential={editing === 'new' ? null : editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={async (c) => {
          setEditing(null);
          toast.success(`${c.name} 已保存`);
          reload();
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>凭据将被永久删除,绑定它的 Server 需重新配置。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await apiVoid(`/api/v1/credentials/${deleting.id}`, { method: 'DELETE' });
                  toast.success(`${deleting.name} 已删除`);
                  setDeleting(null);
                  reload();
                } catch (cause) {
                  toast.error('删除失败', { description: errorMessage(cause) });
                }
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
