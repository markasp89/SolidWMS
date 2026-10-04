const numberFormat = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 3 })
const dateTimeFormat = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' })

export const formatNumber = (value: number | null | undefined) => numberFormat.format(value ?? 0)

export const formatDateTime = (value: string | null | undefined) => (value ? dateTimeFormat.format(new Date(value)) : '—')

export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—'
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'przed chwilą'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min temu`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} godz. temu`
  return formatDateTime(value)
}
