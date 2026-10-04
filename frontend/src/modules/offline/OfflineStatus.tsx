import { useState } from 'react'
import { formatDateTime } from '@/core/format'
import { Button } from '@/core/ui/Button'
import { Icon } from '@/core/ui/Icon'
import { Modal } from '@/core/ui/Modal'
import { notifyStockChanged } from '@/modules/inventory'
import { describe, discard, flush, useQueue } from './queue'

/** Topbar indicator: offline state and operations waiting to be sent. */
export function OfflineStatus() {
  const { pending, failed, sending, online } = useQueue()
  const [open, setOpen] = useState(false)

  if (online && pending.length === 0 && failed.length === 0) return null

  const label = !online ? 'Offline' : sending ? 'Wysyłanie…' : failed.length ? 'Błędy' : 'Kolejka'
  const count = pending.length + failed.length

  return (
    <>
      <button
        type="button"
        className={`offline-pill ${!online ? 'is-offline' : ''} ${failed.length ? 'has-errors' : ''}`}
        onClick={() => setOpen(true)}
        title="Operacje zapisane bez połączenia"
      >
        <Icon name={online ? 'refresh' : 'wifiOff'} size={16} />
        <span>{label}</span>
        {count > 0 && <span className="offline-count">{count}</span>}
      </button>
      {open && (
        <Modal
          open
          title="Operacje offline"
          onClose={() => setOpen(false)}
          footer={
            <Button
              variant="primary"
              icon="refresh"
              loading={sending}
              disabled={pending.length === 0}
              onClick={() => flush().then(notifyStockChanged)}
            >
              Wyślij teraz
            </Button>
          }
        >
          {!online && <p className="alert alert-warn">Brak połączenia. Operacje zostaną wysłane automatycznie, gdy wróci sieć.</p>}
          {pending.length === 0 && failed.length === 0 && <p className="muted">Wszystko wysłane.</p>}
          <ul className="list">
            {pending.map((r) => (
              <li key={r.id} className="queue-item">
                <span className="badge">czeka</span> {describe(r)} <span className="muted">{formatDateTime(r.createdAt)}</span>
              </li>
            ))}
            {failed.map((r) => (
              <li key={r.id} className="queue-item">
                <span className="badge badge-out">odrzucona</span> {describe(r)} <span className="muted">{formatDateTime(r.createdAt)}</span>
                <div className="field-error">{r.error}</div>
                <button type="button" className="link" onClick={() => discard(r.id)}>
                  Usuń z listy
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  )
}
