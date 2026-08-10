export type Tone = 'ready' | 'pending' | 'error' | 'muted';

export function relativeDate(value: string | null | undefined): string {
  if (!value) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function runtimeTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'ready':
    case 'ok':
      return 'ready';
    case 'connecting':
    case 'degraded':
    case 'auth-required':
    case 'pending':
      return 'pending';
    case 'unreachable':
    case 'invalid':
    case 'expired':
    case 'start-failed':
      return 'error';
    default:
      return 'muted';
  }
}

export function toneDot(tone: Tone): string {
  switch (tone) {
    case 'ready':
      return 'bg-emerald-400';
    case 'pending':
      return 'bg-amber-400';
    case 'error':
      return 'bg-red-400';
    default:
      return 'bg-zinc-500';
  }
}

export function toneText(tone: Tone): string {
  switch (tone) {
    case 'ready':
      return 'text-emerald-400';
    case 'pending':
      return 'text-amber-400';
    case 'error':
      return 'text-red-400';
    default:
      return 'text-zinc-500';
  }
}
