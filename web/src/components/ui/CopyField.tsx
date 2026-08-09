import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from './Button.js';

export function CopyField({
  value,
  openable = false,
}: {
  value: string;
  openable?: boolean;
}): ReactNode {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="copy-field">
      <code title={value}>{value}</code>
      {openable && (
        <Button
          variant="quiet"
          size="icon"
          aria-label="打开链接"
          onClick={() => window.open(value, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink size={16} strokeWidth={1.8} />
        </Button>
      )}
      <Button
        variant="quiet"
        size="icon"
        aria-label={failed ? '复制失败，请手动选择' : '复制'}
        onClick={async () => {
          setFailed(false);
          try {
            await writeClipboard(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? <Check size={16} strokeWidth={1.8} /> : <Copy size={16} strokeWidth={1.8} />}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? '已复制' : failed ? '复制失败，请手动选择内容' : ''}
      </span>
    </div>
  );
}

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard) {
    const written = await navigator.clipboard.writeText(value).then(
      () => true,
      () => false,
    );
    if (written) return;
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    field.remove();
  }
  if (!copied) throw new Error('Clipboard is unavailable');
}
