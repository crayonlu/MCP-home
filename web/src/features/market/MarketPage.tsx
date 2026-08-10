import { Boxes, Plug, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMarket, useMarketUninstall } from '../../app/queries'
import { useI18n } from '../../i18n'
import { useToast } from '../../components/ui/Toast'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Badge, EmptyState, StatusDot } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { InstallSheet } from './InstallSheet'
import type { MarketEntry } from '../../api/types'

const categoryLabel: Record<string, string> = {
  devtools: 'devtools',
  productivity: 'productivity',
  comms: 'comms',
  finance: 'finance',
  design: 'design',
  infra: 'infra',
  data: 'data',
  search: 'search',
  email: 'email',
  ai: 'ai',
  browser: 'browser',
}

export function MarketPage() {
  const { t } = useI18n()
  const { toast } = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { data: entries, isLoading } = useMarket()
  const uninstall = useMarketUninstall()
  const [installTarget, setInstallTarget] = useState<MarketEntry | null>(null)

  const remove = async (entry: MarketEntry) => {
    const ok = await confirm({
      title: 'uninstall',
      description: `Uninstall ${entry.name}? Its server and credential will be removed.`,
      confirmLabel: 'uninstall',
      danger: true,
    })
    if (!ok) return
    uninstall.mutate(
      { id: entry.id },
      {
        onSuccess: () => toast(`✗ ${entry.name} uninstalled`, 'success'),
        onError: (error) => toast(error.message, 'error'),
      },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">Market</h1>
      </div>

      {isLoading ? (
        <div className="text-sm text-ink-3">{t('common.loading')}</div>
      ) : entries && entries.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 bg-surface p-4 transition-colors hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{entry.name}</span>
                    {entry.kind === 'remote' ? (
                      <Badge tone="accent">remote</Badge>
                    ) : (
                      <Badge tone="neutral">stdio</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-3">
                    {categoryLabel[entry.category] ?? entry.category}
                  </div>
                </div>
                {entry.installed ? (
                  <StatusDot tone="success" />
                ) : (
                  <StatusDot tone="neutral" />
                )}
              </div>
              <p className="line-clamp-2 min-h-[32px] text-[13px] text-ink-2">
                {entry.description}
              </p>
              <div className="flex items-center justify-between">
                {entry.installed ? (
                  <Button variant="ghost" size="sm" onClick={() => remove(entry)}>
                    <Trash2 className="size-3.5" />
                    uninstall
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => setInstallTarget(entry)}>
                    <Plug className="size-3.5" />
                    install
                  </Button>
                )}
                {entry.installed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/servers?slug=${entry.id}`)}
                  >
                    open
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Boxes className="size-8" />} title={t('common.empty')} />
      )}

      {installTarget && (
        <InstallSheet
          entry={installTarget}
          onOpenChange={(open) => !open && setInstallTarget(null)}
          onInstalled={() => {
            if (installTarget.credential.type === 'oauth') {
              navigate('/credentials')
            }
          }}
        />
      )}
    </div>
  )
}
