import { useEffect, useState } from 'react'
import { useCredentials } from '../../app/queries'
import { useI18n } from '../../i18n'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { FieldGroup, TextField } from '../../components/ui/Field'
import { SelectField } from '../../components/ui/SelectField'
import { Toggle } from '../../components/ui/Toggle'
import type { ServerKind, ServerRecord, Transport } from '../../api/types'

export interface ServerFormValue {
  slug: string
  name: string
  kind: ServerKind
  transport: Transport
  credentialId: string | null
  enabled: boolean
  settings?: { urlClientId?: boolean }
}

type RegistrationMode = 'auto' | 'url' | 'dcr'

const registrationToUrlClientId: Record<RegistrationMode, boolean | undefined> = {
  auto: undefined,
  url: true,
  dcr: false,
}

const registrationFromUrlClientId = (value?: boolean): RegistrationMode =>
  value === true ? 'url' : value === false ? 'dcr' : 'auto'

export function ServerFormSheet({
  open,
  onOpenChange,
  initial,
  onSubmit,
  submitting,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: ServerRecord
  onSubmit: (value: ServerFormValue) => void
  submitting: boolean
  title: string
}) {
  const { t } = useI18n()
  const { data: credentials } = useCredentials()
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ServerKind>('remote')
  const [url, setUrl] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [credentialId, setCredentialId] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [registration, setRegistration] = useState<RegistrationMode>('auto')

  useEffect(() => {
    if (!open) return
    setSlug(initial?.slug ?? '')
    setName(initial?.name ?? '')
    setKind(initial?.kind ?? 'remote')
    setUrl(initial?.transport.type === 'streamable-http' ? initial.transport.url : '')
    setCommand(initial?.transport.type === 'stdio' ? initial.transport.command : '')
    setArgs(initial?.transport.type === 'stdio' ? (initial.transport.args ?? []).join(' ') : '')
    setCredentialId(initial?.credentialId ?? '')
    setEnabled(initial?.enabled ?? true)
    setRegistration(registrationFromUrlClientId(initial?.settings?.urlClientId))
  }, [open, initial])

  const submit = () => {
    const transport: Transport =
      kind === 'remote' ? { type: 'streamable-http', url } : { type: 'stdio', command, args: args ? args.split(' ').filter(Boolean) : [] }
    const urlClientId = registrationToUrlClientId[registration]
    onSubmit({
      slug,
      name,
      kind,
      transport,
      credentialId: credentialId || null,
      enabled,
      settings: urlClientId === undefined ? undefined : { urlClientId },
    })
  }

  const credentialOptions = [
    { value: '', label: t('common.empty') },
    ...(credentials ?? []).map((credential) => ({
      value: credential.id,
      label: credential.name,
    })),
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <FieldGroup>
        <TextField label={t('common.name')} value={name} onChange={setName} required />
        <TextField label={t('common.slug')} value={slug} onChange={setSlug} mono required />
        <SelectField
          label={t('common.kind')}
          value={kind}
          onChange={(value) => setKind(value as ServerKind)}
          options={[
            { value: 'remote', label: 'remote' },
            { value: 'home', label: 'home' },
          ]}
        />
        {kind === 'remote' ? (
          <TextField label={t('common.url')} value={url} onChange={setUrl} mono required />
        ) : (
          <>
            <TextField label="command" value={command} onChange={setCommand} mono required />
            <TextField label="args" value={args} onChange={setArgs} mono />
          </>
        )}
        <SelectField
          label={t('common.type')}
          value={credentialId}
          onChange={setCredentialId}
          options={credentialOptions}
        />
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-2">{t('common.enable')}</span>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>
        {kind === 'remote' && (
          <SelectField
            label="OAuth client registration"
            value={registration}
            onChange={(value) => setRegistration(value as RegistrationMode)}
            options={[
              { value: 'auto', label: 'auto (follow global default)' },
              { value: 'url', label: 'URL-based client metadata' },
              { value: 'dcr', label: 'dynamic client registration (DCR)' },
            ]}
          />
        )}
      </FieldGroup>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          loading={submitting}
          disabled={!name || !slug || (kind === 'remote' ? !url : !command)}
          onClick={submit}
        >
          {t('common.save')}
        </Button>
      </div>
    </Sheet>
  )
}
