import { Plus, Server as ServerIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  useCreateServer,
  useDeleteServer,
  useServerAction,
  useServers,
  useUpdateServer,
} from '../../app/queries'
import { useI18n } from '../../i18n'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Badge, EmptyState, StatusDot } from '../../components/ui/Badge'
import { Toggle } from '../../components/ui/Toggle'
import { ActionsMenu } from '../../components/ui/Menu'
import { runtimeStatusLabel, runtimeStatusMeta } from '../../app/status'
import { ServerFormSheet, type ServerFormValue } from './ServerForm'
import type { ServerRecord } from '../../api/types'

export function ServersPage() {
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const { data: servers, isLoading } = useServers()
  const createServer = useCreateServer()
  const updateServer = useUpdateServer()
  const deleteServer = useDeleteServer()
  const serverAction = useServerAction()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ServerRecord | undefined>(undefined)

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const openEdit = (server: ServerRecord) => {
    setEditing(server)
    setFormOpen(true)
  }

  const handleSubmit = (value: ServerFormValue) => {
    const done = () => {
      setFormOpen(false)
      toast(editing ? t('common.save') : t('common.create'), 'success')
    }
    if (editing) {
      updateServer.mutate(
        { id: editing.id, input: value },
        { onSuccess: done, onError: (error) => toast(error.message, 'error') },
      )
    } else {
      createServer.mutate(value, { onSuccess: done, onError: (error) => toast(error.message, 'error') })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">{t('nav.servers')}</h1>
        <Button variant="primary" onClick={openCreate}>
          <Plus className="size-4" />
          {t('common.add')}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-ink-3">{t('common.loading')}</div>
      ) : servers && servers.length > 0 ? (
        <div className="flex flex-col divide-y divide-ink-3/10">
          {servers.map((server) => {
            const meta = runtimeStatusMeta(server.runtime?.status ?? 'unknown')
            return (
              <div key={server.id} className="flex min-h-[52px] items-center gap-3 px-1 py-2">
                <StatusDot tone={meta.tone} pulse={meta.pulse} />
                <Link to={`/servers/${server.id}`} className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-ink">{server.name}</span>
                  <span className="truncate font-mono text-xs text-ink-3">{server.slug}</span>
                </Link>
                <Badge tone={server.kind === 'remote' ? 'accent' : 'neutral'}>{server.kind}</Badge>
                <span className="hidden w-20 text-right text-xs text-ink-2 sm:block">
                  {runtimeStatusLabel(server.runtime?.status ?? 'unknown', locale)}
                </span>
                <Toggle
                  checked={server.enabled}
                  onChange={(enabled) =>
                    updateServer.mutate(
                      { id: server.id, input: { enabled } },
                      { onError: (error) => toast(error.message, 'error') },
                    )
                  }
                />
                <ActionsMenu
                  actions={[
                    {
                      label: t('common.refresh'),
                      onSelect: () => serverAction.mutate({ id: server.id, action: 'refresh' }),
                    },
                    {
                      label: 'restart',
                      onSelect: () => serverAction.mutate({ id: server.id, action: 'restart' }),
                    },
                    { label: t('common.edit'), onSelect: () => openEdit(server) },
                    {
                      label: t('common.delete'),
                      danger: true,
                      onSelect: () => {
                        if (window.confirm(`${t('common.delete')} ${server.name}?`)) {
                          deleteServer.mutate(
                            { id: server.id },
                            { onError: (error) => toast(error.message, 'error') },
                          )
                        }
                      },
                    },
                  ]}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<ServerIcon className="size-8" />}
          title={t('common.empty')}
          action={
            <Button variant="primary" onClick={openCreate}>
              <Plus className="size-4" />
              {t('common.add')}
            </Button>
          }
        />
      )}

      <ServerFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={handleSubmit}
        submitting={createServer.isPending || updateServer.isPending}
        title={editing ? t('common.edit') : t('common.add')}
      />
    </div>
  )
}
