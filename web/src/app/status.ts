import type { Tone } from '../components/ui/Badge'
import type { CredentialStatus, RuntimeStatus } from '../api/types'
import type { Locale } from '../i18n/types'

export interface StatusMeta {
  tone: Tone
  pulse?: boolean
}

export function runtimeStatusMeta(status: RuntimeStatus): StatusMeta {
  switch (status) {
    case 'ready':
      return { tone: 'success' }
    case 'connecting':
      return { tone: 'accent', pulse: true }
    case 'disabled':
      return { tone: 'neutral' }
    case 'auth-required':
      return { tone: 'warning' }
    case 'unreachable':
    case 'error':
      return { tone: 'danger' }
    default:
      return { tone: 'neutral' }
  }
}

export function runtimeStatusLabel(status: RuntimeStatus, locale: Locale) {
  const zh: Record<RuntimeStatus, string> = {
    ready: '就绪',
    connecting: '连接中',
    disabled: '已停用',
    unknown: '未知',
    unreachable: '不可达',
    'auth-required': '需授权',
    error: '错误',
    stopping: '停止中',
  }
  const en: Record<RuntimeStatus, string> = {
    ready: 'Ready',
    connecting: 'Connecting',
    disabled: 'Disabled',
    unknown: 'Unknown',
    unreachable: 'Unreachable',
    'auth-required': 'Auth required',
    error: 'Error',
    stopping: 'Stopping',
  }
  return locale === 'zh' ? zh[status] : en[status]
}

export function credentialStatusMeta(status: CredentialStatus): StatusMeta {
  switch (status) {
    case 'ready':
      return { tone: 'success' }
    case 'pending':
      return { tone: 'warning', pulse: true }
    case 'expired':
      return { tone: 'warning' }
    case 'invalid':
      return { tone: 'danger' }
  }
}

export function credentialStatusLabel(status: CredentialStatus, locale: Locale) {
  const zh: Record<CredentialStatus, string> = {
    ready: '就绪',
    pending: '等待授权',
    expired: '已过期',
    invalid: '无效',
  }
  const en: Record<CredentialStatus, string> = {
    ready: 'Ready',
    pending: 'Pending auth',
    expired: 'Expired',
    invalid: 'Invalid',
  }
  return locale === 'zh' ? zh[status] : en[status]
}
