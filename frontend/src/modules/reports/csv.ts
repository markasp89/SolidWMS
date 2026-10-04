import { saveFile } from '@/core/saveFile'
import { isoDate } from './dates'

export type CsvValue = string | number | null | undefined

/**
 * CSV for Polish Excel: `;` separator, decimal comma, CRLF line endings.
 * (The UTF-8 BOM is added when downloading.)
 */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
}

function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : ''
  return /[";\r\n]/.test(value) || /^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Downloads the CSV generated in the browser, e.g. raport-rotacja-2026-10-04.csv. */
export function downloadCsv(name: string, content: string): Promise<void> {
  return saveFile(`raport-${name}-${isoDate(new Date())}.csv`, new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' }))
}
