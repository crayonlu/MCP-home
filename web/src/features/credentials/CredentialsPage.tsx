import { KeyRound, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  useCreateCredential,
  useCredentials,
  useDeleteCredential,
  useRevokeCredential,
  useTestCredential,
} from '../../app/queries'
import { useI18n } from '../../i18n'
import { useToast } from '../../components/ui/Toast'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Button } from '../../components/ui/Button'
import { Badge, EmptyState, StatusDot } from '../../components/ui/Badge'
import { ActionsMenu } from '../../components/ui/Menu'
import { credentialStatusLabel, credentialStatusMeta } from '../../app/status'
import { CredentialFormSheet } from './CredentialForm'
import { OAuthAuthorizeSheet } from './OAuthAuthorizeSheet'
import type { CredentialRecord, CredentialType } from '../../api/types'

const typeTone: Record<CredentialType, 'accent' | 'neutral' | 'success' | 'warning' | 'danger'> = {
  bearer: 'accent',
  'api-key': 'success',
  headers: 'warning',
  env: 'neutral',
  oauth: 'danger',
}

export function CredentialsPage() {
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const confirm = useConfirm()
  const { data: credentials, isLoading } = useCredentials()
  const createCredential = useCreateCredential()
  const deleteCredential = useDeleteCredential()
  const revokeCredential = useRevokeCredential()
  const testCredential = useTestCredential()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CredentialRecord | undefined>(undefined)
  const [authTarget, setAuthTarget] = useState<CredentialRecord | null>(null)
  const refreshedRef = useRef(new Set<string>())

  useEffect(() => {
    for (const credential of credentials ?? []) {
      if (
        credential.type === 'oauth' &&
        credential.status === 'expired' &&
        !refreshedRef.current.has(credential.id)
      ) {
        refreshedRef.current.add(credential.id)
        testCredential.mutate({ id: credential.id })
      }
    }
  }, [credentials])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">{t('nav.credentials')}</h1>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(undefined)
            setFormOpen(true)
          }}
        >
          <Plus className="size-4" />
          {t('common.add')}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-ink-3">{t('common.loading')}</div>
      ) : credentials && credentials.length > 0 ? (
        <div className="flex flex-col divide-y divide-ink-3/10">
          {credentials.map((credential) => {
            const meta = credentialStatusMeta(credential.status)
            return (
              <div key={credential.id} className="flex min-h-[52px] items-center gap-3 px-1 py-2">
                <StatusDot tone={meta.tone} pulse={meta.pulse} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-ink">{credential.name}</span>
                  <span className="truncate text-xs text-ink-3">
                    {credentialStatusLabel(credential.status, locale)}
                    {credential.expiresAt
                      ? ` · ${new Date(credential.expiresAt).toLocaleDateString()}`
                      : ''}
                  </span>
                </div>
                <Badge tone={typeTone[credential.type]}>{credential.type}</Badge>
                <ActionsMenu
                  actions={[
                    ...(credential.type === 'oauth'
                      ? [
                          {
                            label: 'authorize',
                            onSelect: () => setAuthTarget(credential),
                          },
                        ]
                      : []),
                    {
                      label: t('common.refresh'),
                      onSelect: () =>
                        testCredential.mutate(
                          { id: credential.id },
                          {
                            onSuccess: (result) =>
                              toast(
                                result.valid ? '✓ valid' : `✗ ${result.error ?? 'invalid'}`,
                                result.valid ? 'success' : 'error',
                              ),
                            onError: (error) => toast(error.message, 'error'),
                          },
                        ),
                    },
                    ...(credential.type === 'oauth'
                      ? [
                          {
                            label: 'revoke',
                            onSelect: () =>
                              revokeCredential.mutate(
                                credential.id,
                                { onError: (error) => toast(error.message, 'error') },
                              ),
                          },
                        ]
                      : []),
                    { label: t('common.edit'), onSelect: () => {
                        setEditing(credential)
                        setFormOpen(true)
                      } },
                    {
                      label: t('common.delete'),
                      danger: true,
                      onSelect: async () => {
                        const ok = await confirm({
                          title: t('common.delete'),
                          description: `${t('common.delete')} ${credential.name}?`,
                          confirmLabel: t('common.delete'),
                          danger: true,
                        })
                        if (!ok) return
                        deleteCredential.mutate(
                          { id: credential.id },
                          { onError: (error) => toast(error.message, 'error') },
                        )
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
          icon={<KeyRound className="size-8" />}
          title={t('common.empty')}
          action={
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              {t('common.add')}
            </Button>
          }
        />
      )}

      <CredentialFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={(value) => {
          createCredential.mutate(value, {
            onSuccess: () => {
              setFormOpen(false)
              toast(t('common.create'), 'success')
            },
            onError: (error) => toast(error.message, 'error'),
          })
        }}
        submitting={createCredential.isPending}
      />

      {authTarget && (
        <OAuthAuthorizeSheet
          open={Boolean(authTarget)}
          onOpenChange={(open) => !open && setAuthTarget(null)}
          credentialId={authTarget.id}
          credentialName={authTarget.name}
        />
      )}
    </div>
  )
}
