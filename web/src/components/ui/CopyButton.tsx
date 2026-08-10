import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../i18n'

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-7 shrink-0 items-center gap-1 px-2 text-xs text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {copied ? t('common.copied') : (label ?? t('common.copy'))}
    </button>
  )
}
