import { api, rawRequest, type Paginated } from '@/core/api/client'
import type { DocumentDetail, DocumentFilters, DocumentInput, DocumentSummary } from './types'

export const documentsApi = {
  list: (filters: DocumentFilters, signal?: AbortSignal) =>
    api.get<Paginated<DocumentSummary>>('/documents', { ...filters }, signal),
  get: (id: number, signal?: AbortSignal) => api.get<DocumentDetail>(`/documents/${id}`, undefined, signal),
  create: (input: DocumentInput) => api.post<DocumentDetail>('/documents', input),
  update: (id: number, input: Omit<DocumentInput, 'type'>) => api.put<DocumentDetail>(`/documents/${id}`, input),
  remove: (id: number) => api.delete(`/documents/${id}`),
  post: (id: number) => api.post<DocumentDetail>(`/documents/${id}/post`),

  /** Downloads the PDF printout and saves it on the user's disk. */
  async downloadPdf(document: Pick<DocumentSummary, 'id' | 'number'>): Promise<void> {
    const response = await rawRequest(`/documents/${document.id}/pdf`)
    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') ?? ''
    const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `${document.number.replaceAll('/', '-')}.pdf`

    const url = URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = filename
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
}
