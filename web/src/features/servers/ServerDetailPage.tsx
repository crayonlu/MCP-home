import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  useDeleteServer,
  useServer,
  useServerAction,
  useServerCapabilities,
  useServerLogs,
  useUpdateServer,
} from '../../app/queries'
import { useI18n } from '../../i18n'
import { useToast } from '../../components/ui/Toast'
import { Badge, StatusDot } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { CopyButton } from '../../components/ui/CopyButton'
import { TabsView, type TabItem } from '../../components/ui/Tabs'
import { ServerFormSheet, type ServerFormValue } from './ServerForm'
import { runtimeStatusLabel, runtimeStatusMeta } from '../../app/status'
import type { ServerRecord } from '../../api/types'

export function ServerDetailPage() {
  const { id = '' } = useParams()
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const { data: server, isLoading } = useServer(id)
  const { data: capability } = useServerCapabilities(id)
  const { data: logs } = useServerLogs(id)
  const updateServer = useUpdateServer()
  const deleteServer = useDeleteServer()
  const serverAction = useServerAction()
  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading || !server) {
    return <div className="text-sm text-ink-3">{t('common.loading')}</div>
  }

  const meta = runtimeStatusMeta(server.runtime?.status ?? 'unknown')
  const endpoint = `https://mcp.cyncyn.xyz/mcp/${server.slug}`

  const tabs: TabItem[] = [
    { value: 'overview', label: 'overview' },
    { value: 'capability', label: `capability (${capability?.tools.length ?? 0})` },
    { value: 'logs', label: 'logs' },
    { value: 'settings', label: 'settings' },
  ]

  const handleSubmit = (value: ServerFormValue) => {
    updateServer.mutate(
      { id, input: value },
      {
        onSuccess: () => {
          setEditOpen(false)
          toast(t('common.save'), 'success')
        },
        onError: (error) => toast(error.message, 'error'),
      },
    )
  }

  const endpointUrl = server.transport.type === 'streamable-http' ? server.transport.url : `${server.transport.command} ${(server.transport.args ?? []).join(' ')}`

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/servers" className="text-sm text-ink-3 hover:text-ink">
              {t('nav.servers')}
            </Link>
            <span className="text-ink-3">/</span>
            <h1 className="text-xl font-semibold tracking-[-0.02em]">{server.name}</h1>
            <Badge tone={server.kind === 'remote' ? 'accent' : 'neutral'}>{server.kind}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-3">
            <StatusDot tone={meta.tone} pulse={meta.pulse} />
            {runtimeStatusLabel(server.runtime?.status ?? 'unknown', locale)}
            <span className="font-mono text-xs">{server.slug}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => serverAction.mutate({ id, action: 'refresh' })}>
            {t('common.refresh')}
          </Button>
          <Button variant="primary" onClick={() => setEditOpen(true)}>
            {t('common.edit')}
          </Button>
        </div>
      </div>

      <TabsView
        tabs={tabs}
        value={tab}
        onChange={setTab}
        render={(value) => {
          if (value === 'overview') {
            return (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="flex flex-col gap-3 bg-surface p-4">
                  <div>
                    <div className="text-xs text-ink-3">{t('common.url')}</div>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">
                        {endpointUrl}
                      </code>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-3">public endpoint</div>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">
                        {endpoint}
                      </code>
                      <CopyButton text={endpoint} />
                    </div>
                  </div>
                  {server.runtime?.lastError && (
                    <div className="text-xs text-danger">{server.runtime.lastError}</div>
                  )}
                </div>
                <div className="flex flex-col gap-3 bg-surface p-4">
                  <div>
                    <div className="text-xs text-ink-3">protocol</div>
                    <div className="font-mono text-sm text-ink">
                      {capability?.protocolVersion ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-3">server info</div>
                    <div className="font-mono text-sm text-ink">
                      {capability?.serverInfo?.name
                        ? `${capability.serverInfo.name} ${capability.serverInfo.version ?? ''}`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-3">tools / prompts / resources</div>
                    <div className="font-mono text-sm text-ink">
                      {capability?.tools.length ?? 0} / {capability?.prompts.length ?? 0} /{' '}
                      {capability?.resources.length ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            )
          }
          if (value === 'capability') {
            return (
              <div className="flex flex-col gap-4">
                {!capability ? (
                  <div className="text-sm text-ink-3">{t('common.loading')}</div>
                ) : (
                  <>
                    <Section title={`tools (${capability.tools.length})`}>
                      {capability.tools.length === 0 ? (
                        <div className="text-xs text-ink-3">—</div>
                      ) : (
                        <div className="grid grid-cols-1 gap-px bg-ink-3/10 sm:grid-cols-2">
                          {capability.tools.map((tool) => (
                            <div key={tool.name} className="bg-surface px-3 py-2">
                              <div className="font-mono text-[13px] text-ink">{tool.name}</div>
                              {tool.description && (
                                <div className="mt-0.5 line-clamp-2 text-xs text-ink-3">
                                  {tool.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Section>
                    <Section title={`prompts (${capability.prompts.length})`}>
                      {capability.prompts.map((prompt) => (
                        <div key={prompt.name} className="px-1 py-1 font-mono text-[13px] text-ink">
                          {prompt.name}
                        </div>
                      ))}
                    </Section>
                  </>
                )}
              </div>
            )
          }
          if (value === 'logs') {
            return (
              <div className="flex flex-col gap-1">
                {(logs ?? []).map((entry, index) => (
                  <div key={index} className="flex items-start gap-3 px-1 py-1 font-mono text-xs">
                    <span className="shrink-0 text-ink-3">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="text-ink-2">{entry.message}</span>
                  </div>
                ))}
                {logs?.length === 0 && <div className="text-sm text-ink-3">—</div>}
              </div>
            )
          }
          return (
            <div className="flex flex-col gap-4">
              <ServerFormSheet
                open={editOpen}
                onOpenChange={setEditOpen}
                initial={server as ServerRecord}
                onSubmit={handleSubmit}
                submitting={updateServer.isPending}
                title={t('common.edit')}
              />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between bg-surface px-4 py-3">
                  <span className="text-sm text-ink-2">restart</span>
                  <Button onClick={() => serverAction.mutate({ id, action: 'restart' })}>
                    restart
                  </Button>
                </div>
                <div className="flex items-center justify-between bg-surface px-4 py-3">
                  <span className="text-sm text-ink-2">{t('common.delete')}</span>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`${t('common.delete')} ${server.name}?`)) {
                        deleteServer.mutate(
                          { id },
                          { onSuccess: () => (window.location.href = '/servers') },
                        )
                      }
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px] font-medium text-ink-3">{title}</div>
      {children}
    </div>
  )
}
