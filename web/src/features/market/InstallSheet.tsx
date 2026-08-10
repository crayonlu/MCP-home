import { useEffect, useState } from 'react'
import { useMarketInstall } from '../../app/queries'
import { useI18n } from '../../i18n'
import { useToast } from '../../components/ui/Toast'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { FieldGroup, TextField } from '../../components/ui/Field'
import type { MarketEntry } from '../../api/types'

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
  const install = useMarketInstall()
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (entry) {
      setValues({})
    }
  }, [entry])

  if (!entry) return null

  const missing = entry.requires.some(
    (requirement) => requirement.required && !values[requirement.name],
  )

  const submit = () => {
    install.mutate(
      { id: entry.id, values },
      {
        onSuccess: () => {
          onOpenChange(false)
          if (entry.credential.type === 'oauth') {
            toast(`installed — authorize ${entry.name}`, 'success')
          } else {
            toast(`✓ ${entry.name} installed`, 'success')
          }
          onInstalled(entry.id)
        },
        onError: (error) => toast(error.message, 'error'),
      },
    )
  }

  return (
    <Sheet open onOpenChange={onOpenChange} title={`install · ${entry.name}`}>
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
          />
        ))}
        {entry.requires.length === 0 && (
          <div className="text-sm text-ink-3">
            {entry.credential.type === 'oauth'
              ? 'authorize after install'
              : 'no configuration needed'}
          </div>
        )}
      </FieldGroup>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" loading={install.isPending} disabled={missing} onClick={submit}>
          {install.isPending ? 'installing…' : t('common.create')}
        </Button>
      </div>
    </Sheet>
  )
}
