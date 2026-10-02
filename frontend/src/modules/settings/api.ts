import { api, rawRequest } from '@/core/api/client'

export interface ImportSummary {
  warehouses: { created: number; updated: number }
  sectors: { created: number; updated: number }
  products: { created: number; updated: number }
  stock: { created: number; updated: number }
  floor_plans: { imported: number }
}

export interface ExportFile {
  format?: string
  version: number
  exported_at?: string
  warehouses: Array<{ code: string; name: string; floor_plan?: { data?: string } | null; sectors?: unknown[] }>
  products: unknown[]
  stock: unknown[]
}

export const settingsApi = {
  /** Downloads the export and saves it as a file on the user's disk. */
  async download(includeImages: boolean): Promise<void> {
    const response = await rawRequest('/settings/export', { query: { include_images: includeImages ? 1 : 0 } })
    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') ?? ''
    const filename =
      /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `solidwms-export-${new Date().toISOString().slice(0, 10)}.json`

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },

  import: (mode: 'merge' | 'replace', data: ExportFile) =>
    api.post<{ summary: ImportSummary }>('/settings/import', { mode, data }),
}

/** Parses and checks the structure of an export file. Returns an error message or the data. */
export function parseExport(text: string): { data?: ExportFile; error?: string } {
  if (!text.trim()) return { error: 'Wklej zawartość pliku lub wybierz plik.' }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { error: `Niepoprawny JSON: ${(e as Error).message}` }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { error: 'Plik musi zawierać obiekt JSON.' }
  }
  const d = data as Partial<ExportFile>
  if (d.format !== undefined && d.format !== 'solidwms') return { error: 'To nie jest plik eksportu SolidWMS.' }
  if (d.version !== 1) return { error: 'Nieobsługiwana wersja pliku (oczekiwano "version": 1).' }
  for (const key of ['warehouses', 'products', 'stock'] as const) {
    if (!Array.isArray(d[key])) return { error: `Brak listy "${key}" w pliku.` }
  }
  return { data: d as ExportFile }
}
