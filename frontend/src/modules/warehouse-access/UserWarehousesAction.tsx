import { useState } from 'react'
import { api } from '@/core/api/client'
import type { User } from '@/core/auth/types'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { Modal } from '@/core/ui/Modal'
import { warehousesApi } from '@/modules/warehouses'

/** Extension "user.actions": which warehouses a user may work in. */
export function UserWarehousesAction({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const { data, setData } = useAsync(
    (signal) => api.get<{ warehouse_ids: number[] }>(`/users/${user.id}/warehouses`, undefined, signal),
    [user.id],
  )

  if (user.role === 'admin') return null
  const count = data?.warehouse_ids.length ?? 0

  return (
    <>
      <Button size="sm" variant="ghost" icon="warehouse" onClick={() => setOpen(true)} title="Dostęp do magazynów">
        {count ? `${count}` : 'wszystkie'}
      </Button>
      {open && data && (
        <AssignModal
          user={user}
          selected={data.warehouse_ids}
          onClose={() => setOpen(false)}
          onSaved={(ids) => {
            setData({ warehouse_ids: ids })
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function AssignModal({ user, selected, onClose, onSaved }: { user: User; selected: number[]; onClose: () => void; onSaved: (ids: number[]) => void }) {
  const { toast } = useFeedback()
  const [ids, setIds] = useState<number[]>(selected)
  const [saving, setSaving] = useState(false)
  const { data: warehouses } = useAsync((signal) => warehousesApi.list(signal), [])

  const save = async () => {
    setSaving(true)
    try {
      const result = await api.put<{ warehouse_ids: number[] }>(`/users/${user.id}/warehouses`, { warehouse_ids: ids })
      toast('Zapisano dostęp do magazynów.')
      onSaved(result.warehouse_ids)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={`Magazyny: ${user.name}`}
      onClose={onClose}
      locked={saving}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Anuluj
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            Zapisz
          </Button>
        </>
      }
    >
      <p className="muted">Bez zaznaczenia użytkownik widzi wszystkie magazyny.</p>
      <ul className="list">
        {warehouses?.map((w) => (
          <li key={w.id}>
            <label className="checkbox list-item">
              <input
                type="checkbox"
                checked={ids.includes(w.id)}
                onChange={(e) => setIds((prev) => (e.target.checked ? [...prev, w.id] : prev.filter((id) => id !== w.id)))}
              />
              <span>
                <strong>{w.code}</strong> {w.name}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
