import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { useI18n } from '../../i18n'
import { useToast } from '../../components/ui/Toast'
import { Sheet } from '../../components/ui/Sheet'
import { Button, Spinner } from '../../components/ui/Button'
import { FieldGroup, TextField } from '../../components/ui/Field'
import type { MarketEntry } from '../../api/types'

interface InstallJob {
  status: 'installing' | 'completed' | 'failed'
  step: string
  output: string
  result?: unknown
  error?: string
}

export function InstallSheet({
  entry,
  onOpenChange,
  onInstalled,
}: {
  entry: MarketEntry | null
  onOpenChange: (open: boolean) => void
  onInstalled: (slug: string) => void
}) {
  const { t } = useI18n()
  const { toast } = useToast()
  const [values, setValues] = useState<Record<string, string>>({})
  const [job, setJob] = useState<InstallJob | null>(null)
  const [installing, setInstalling] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (entry) {
      setValues({})
      setJob(null)
      setInstalling(false)
    }
  }, [entry])

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [job?.output])

  if (!entry) return null

  const missing = entry.requires.some(
    (requirement) => requirement.required && !values[requirement.name],
  )

  const submit = async () => {
    setInstalling(true)
    setJob({ status: 'installing', step: 'starting', output: '' })
    try {
      const started = (await api.post(`/api/v1/market/${entry.id}/install`, {
        values,
      })) as { jobId: string }
      for (;;) {
        const current = await api.get<InstallJob>(`/api/v1/market/install/${started.jobId}`)
        setJob(current)
        if (current.status !== 'installing') {
          setInstalling(false)
          if (current.status === 'failed') {
            toast(current.error ?? 'install failed', 'error')
            return
          }
          onOpenChange(false)
          if (entry.credential.type === 'oauth') {
            toast(t('market.installedAuthorize', { name: entry.name }), 'success')
          } else {
            toast(`✓ ${entry.name} ${t('market.install')}`, 'success')
          }
          onInstalled(entry.id)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    } catch (error) {
      setInstalling(false)
      toast((error as Error).message, 'error')
    }
  }

  const installingNow = installing && job?.status === 'installing'

  return (
    <Sheet open onOpenChange={onOpenChange} title={`${t('market.install')} · ${entry.name}`}>
      <p className="mb-4 text-sm text-ink-2">{entry.description}</p>
      <FieldGroup>
        {entry.requires.map((requirement) => (
          <TextField
            key={requirement.name}
            label={requirement.description || requirement.name}
            value={values[requirement.name] ?? ''}
            onChange={(value) =>
              setValues((current) => ({ ...current, [requirement.name]: value }))
            }
            type={requirement.secret ? 'password' : 'text'}
            mono
            required={requirement.required}
            disabled={installingNow}
          />
        ))}
        {entry.requires.length === 0 && (
          <div className="text-sm text-ink-3">
            {entry.credential.type === 'oauth'
              ? t('market.authorizeAfter')
              : t('market.noConfig')}
          </div>
        )}
      </FieldGroup>

      {installingNow && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-ink">
            <Spinner className="size-3.5" />
            <span className="truncate">{job?.step}</span>
          </div>
          <div className="h-1 w-full bg-surface-2">
            <div className="h-full w-1/3 animate-pulse bg-accent" />
          </div>
          <pre
            ref={outputRef}
            className="max-h-40 overflow-auto bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink-2"
          >
            {job?.output || '…'}
          </pre>
        </div>
      )}

      {job?.status === 'failed' && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="text-sm text-danger">{job.error}</div>
          <pre className="max-h-40 overflow-auto bg-surface-2 p-3 font-mono text-xs text-ink-2">
            {job.output}
          </pre>
          <div>
            <Button variant="primary" onClick={submit}>
              {t('common.retry')}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={installingNow}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          loading={installingNow}
          disabled={missing || installingNow}
          onClick={submit}
        >
          {installingNow ? t('market.installing') : t('common.create')}
        </Button>
      </div>
    </Sheet>
  )
}
