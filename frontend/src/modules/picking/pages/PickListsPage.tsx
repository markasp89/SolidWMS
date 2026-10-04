import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDateTime } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { Icon } from '@/core/ui/Icon'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { pickingApi } from '../api'
import { NewPickListModal } from '../components/NewPickListModal'
import { ProgressBar } from '../components/ProgressBar'
import { progressOf, STATUS_BADGES, STATUS_LABELS } from '../labels'
import type { PickListStatus } from '../types'

const ORDER: Record<PickListStatus, number> = { open: 0, completed: 1, cancelled: 2 }

export function PickListsPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<PickListStatus | ''>('')
  const [creating, setCreating] = useState(false)
  const { data, error, loading, reload } = useAsync((signal) => pickingApi.list(status || undefined, signal), [status])

  // Open lists first; the server already returns the newest first within each group.
  const lists = [...(data ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status])

  return (
    <>
      <PageHeader
        title="Kompletacja"
        subtitle="Listy zbiórki z lokalizacjami ułożonymi w kolejności przejścia przez magazyn."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            Nowa lista
          </Button>
        }
      />

      <div className="tabs" role="tablist">
        {(
          [
            ['', 'Wszystkie'],
            ['open', 'W trakcie'],
            ['completed', 'Zakończone'],
            ['cancelled', 'Anulowane'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            className={status === value ? 'is-active' : ''}
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && lists.length === 0 && (
        <EmptyState icon="list" title="Brak list kompletacyjnych">
          <Button icon="plus" onClick={() => setCreating(true)}>
            Utwórz listę
          </Button>
        </EmptyState>
      )}

      {lists.length > 0 && (
        <ul className="pick-lists">
          {lists.map((list) => {
            const progress = progressOf(list)
            return (
              <li key={list.id}>
                <Link to={`/picking/${list.id}`} className={`card pick-list-card pick-list-${list.status}`}>
                  <div className="pick-list-head">
                    <strong>{list.number}</strong>
                    <span className={`badge ${STATUS_BADGES[list.status]}`}>{STATUS_LABELS[list.status]}</span>
                    <Icon name="chevronRight" size={18} />
                  </div>
                  <div className="muted">
                    {list.warehouse ? `${list.warehouse.code} – ${list.warehouse.name}` : '—'} · {formatDateTime(list.created_at)}
                    {list.created_by && ` · ${list.created_by.name}`}
                  </div>
                  {list.note && <div className="pick-list-note">{list.note}</div>}
                  <ProgressBar done={progress.done} total={progress.total} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {creating && (
        <NewPickListModal
          onClose={() => setCreating(false)}
          onCreated={(list) => {
            setCreating(false)
            navigate(`/picking/${list.id}`)
          }}
        />
      )}
    </>
  )
}
