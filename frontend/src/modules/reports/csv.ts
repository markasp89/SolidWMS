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
export function downloadCsv(name: string, content: string) {
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `raport-${name}-${isoDate(new Date())}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
