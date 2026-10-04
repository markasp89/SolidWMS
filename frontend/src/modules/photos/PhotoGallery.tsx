import { useRef, useState, type ChangeEvent } from 'react'
import { api, apiUrl, request } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'
import { formatDateTime } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { Modal } from '@/core/ui/Modal'

export type PhotoSubject = 'product' | 'stock_item' | 'pallet'

interface Photo {
  id: number
  url: string
  caption: string | null
  user: { id: number; name: string } | null
  created_at: string
}

/** Thumbnails with upload (phone camera) and a full-size viewer. */
export function PhotoGallery({ subjectType, subjectId, emptyText = 'Brak zdjęć.' }: { subjectType: PhotoSubject; subjectId: number; emptyText?: string }) {
  const { user, isManager } = useAuth()
  const { toast, confirm } = useFeedback()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<Photo | null>(null)
  const { data, setData } = useAsync(
    (signal) => api.get<Photo[]>('/photos', { subject_type: subjectType, subject_id: subjectId }, signal),
    [subjectType, subjectId],
  )

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const body = new FormData()
    body.append('subject_type', subjectType)
    body.append('subject_id', String(subjectId))
    body.append('photo', file)
    setUploading(true)
    try {
      const photo = await request<Photo>('/photos', { method: 'POST', body })
      setData((list) => [photo, ...(list ?? [])])
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const remove = async (photo: Photo) => {
    if (!(await confirm({ title: 'Usunąć zdjęcie?', message: 'Zdjęcie zostanie usunięte.', confirmLabel: 'Usuń', danger: true }))) return
    try {
      await api.delete(`/photos/${photo.id}`)
      setData((list) => (list ?? []).filter((p) => p.id !== photo.id))
      setViewing(null)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div className="gallery">
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={upload} />
      {data?.length ? (
        <div className="gallery-grid">
          {data.map((p) => (
            <button key={p.id} type="button" className="gallery-thumb" onClick={() => setViewing(p)}>
              <img src={apiUrl(p.url)} alt={p.caption ?? 'Zdjęcie'} loading="lazy" />
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">{emptyText}</p>
      )}
      <Button size="sm" icon="camera" loading={uploading} onClick={() => input.current?.click()}>
        Dodaj zdjęcie
      </Button>

      {viewing && (
        <Modal
          open
          size="lg"
          title={viewing.caption ?? 'Zdjęcie'}
          onClose={() => setViewing(null)}
          footer={
            (viewing.user?.id === user?.id || isManager) && (
              <Button icon="trash" variant="danger" onClick={() => remove(viewing)}>
                Usuń
              </Button>
            )
          }
        >
          <img className="gallery-full" src={apiUrl(viewing.url)} alt="" />
          <p className="muted">
            {viewing.user?.name ?? '—'}, {formatDateTime(viewing.created_at)}
          </p>
        </Modal>
      )}
    </div>
  )
}
