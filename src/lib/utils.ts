export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export function fakeEmail(pseudo: string): string {
  return `${pseudo.toLowerCase().replace(/\s+/g, '_')}@myshift.app`
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatTimestamp(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function elapsed(start: string | null, end?: string | null): string {
  if (!start) return '—'
  const endDate = end ? new Date(end) : new Date()
  const ms = endDate.getTime() - new Date(start).getTime()
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
