import { Globe } from 'lucide-react'
import { useServers } from '../../app/queries'
import { useI18n } from '../../i18n'
import { CopyButton } from '../../components/ui/CopyButton'

export function EndpointsPage() {
  const { t } = useI18n()
  const { data: servers, isLoading } = useServers()

  const base = 'https://mcp.cyncyn.xyz'
  const aggregate = `${base}/mcp`

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold tracking-[-0.02em]">{t('nav.endpoints')}</h1>

      <div className="flex flex-col gap-2 bg-surface px-4 py-4">
        <div className="text-[13px] font-medium text-ink-3">aggregate</div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{aggregate}</code>
          <CopyButton text={aggregate} />
        </div>
      </div>

      <div className="flex flex-col divide-y divide-ink-3/10">
        {(servers ?? []).map((server) => {
          const endpoint = `${base}/mcp/${server.slug}`
          return (
            <div key={server.id} className="flex items-center gap-3 px-1 py-2.5">
              <Globe className="size-4 shrink-0 text-ink-3" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-ink">{server.name}</span>
                <code className="truncate font-mono text-xs text-ink-3">{endpoint}</code>
              </div>
              <CopyButton text={endpoint} />
            </div>
          )
        })}
        {!isLoading && servers?.length === 0 && (
          <div className="py-10 text-center text-sm text-ink-3">{t('common.empty')}</div>
        )}
      </div>
    </div>
  )
}
