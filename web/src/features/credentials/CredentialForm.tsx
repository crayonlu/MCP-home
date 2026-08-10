import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { FieldGroup, TextField, TextareaField } from '../../components/ui/Field'
import { SelectField } from '../../components/ui/SelectField'
import type { CredentialRecord, CredentialType } from '../../api/types'

export function CredentialFormSheet({
  open,
  onOpenChange,
  initial,
  onSubmit,
  submitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: CredentialRecord
  onSubmit: (value: { name: string; payload: unknown }) => void
  submitting: boolean
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [type, setType] = useState<CredentialType>('bearer')
  const [token, setToken] = useState('')
  const [headerName, setHeaderName] = useState('Authorization')
  const [headerValue, setHeaderValue] = useState('')
  const [headersText, setHeadersText] = useState('{}')
  const [envText, setEnvText] = useState('{}')

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setType(initial?.type ?? 'bearer')
    setToken('')
    setHeaderName('Authorization')
    setHeaderValue('')
    setHeadersText('{}')
    setEnvText('{}')
  }, [open, initial])

  const submit = () => {
    let payload: unknown
    switch (type) {
      case 'bearer':
        payload = { type: 'bearer', token }
        break
      case 'api-key':
        payload = { type: 'api-key', headerName, value: headerValue }
        break
      case 'headers':
        payload = { type: 'headers', headers: safeJson(headersText) }
        break
      case 'env':
        payload = { type: 'env', variables: safeJson(envText) }
        break
      case 'oauth':
        payload = { type: 'oauth' }
        break
    }
    onSubmit({ name, payload })
  }

  const typeOptions = [
    { value: 'bearer', label: 'bearer' },
    { value: 'api-key', label: 'api-key' },
    { value: 'headers', label: 'headers' },
    { value: 'env', label: 'env' },
    { value: 'oauth', label: 'oauth' },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={initial ? t('common.edit') : t('common.add')}>
      <FieldGroup>
        <TextField label={t('common.name')} value={name} onChange={setName} required />
        <SelectField
          label={t('common.type')}
          value={type}
          onChange={(value) => setType(value as CredentialType)}
          options={typeOptions}
        />
        {type === 'bearer' && (
          <TextField label="token" value={token} onChange={setToken} mono type="password" required />
        )}
        {type === 'api-key' && (
          <>
            <TextField label="header name" value={headerName} onChange={setHeaderName} mono />
            <TextField
              label="value"
              value={headerValue}
              onChange={setHeaderValue}
              mono
              type="password"
              required
            />
          </>
        )}
        {type === 'headers' && (
          <TextareaField
            label="headers (JSON)"
            value={headersText}
            onChange={setHeadersText}
            mono
            rows={4}
          />
        )}
        {type === 'env' && (
          <TextareaField
            label="variables (JSON)"
            value={envText}
            onChange={setEnvText}
            mono
            rows={4}
          />
        )}
        {type === 'oauth' && (
          <p className="text-[13px] text-ink-3">{t('credential.oauthHint')}</p>
        )}
      </FieldGroup>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          loading={submitting}
          disabled={!name || (type === 'bearer' ? !token : type === 'api-key' ? !headerValue : false)}
          onClick={submit}
        >
          {t('common.save')}
        </Button>
      </div>
    </Sheet>
  )
}

function safeJson(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    return {}
  }
  return {}
}
