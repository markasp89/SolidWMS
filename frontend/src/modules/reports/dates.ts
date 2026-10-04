import type { Period } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Local date as YYYY-MM-DD. */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const today = (): string => isoDate(new Date())

export function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return isoDate(date)
}

/** Database timestamps come as UTC "YYYY-MM-DD HH:MM:SS" (no zone) – turn them into a Date. */
export function parseDbDate(value: string | null): Date | null {
  if (!value) return null
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

/** ISO-like local timestamp for spreadsheets: YYYY-MM-DD HH:MM. */
export function spreadsheetDateTime(value: string | null): string {
  const date = parseDbDate(value)
  return date ? `${isoDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}` : ''
}

export const defaultPeriod = (): Period => ({ from: daysAgo(30), to: today() })

/** Validation message for an incomplete or reversed period. */
export function periodError(period: Period): string | null {
  if (!period.from || !period.to) return 'Wybierz początek i koniec okresu.'
  if (period.from > period.to) return 'Data początkowa jest późniejsza niż końcowa.'
  return null
}
