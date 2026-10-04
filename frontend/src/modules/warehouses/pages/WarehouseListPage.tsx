import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiUrl } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { Icon } from '@/core/ui/Icon'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { warehousesApi } from '../api'
import { WarehouseFormModal } from '../components/WarehouseFormModal'

export function WarehouseListPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const { data, error, loading, reload } = useAsync((signal) => warehousesApi.list(signal), [])

  return (
    <>
      <PageHeader
        title="Magazyny"
        subtitle="Wybierz magazyn, aby zobaczyć rzut i sektory."
        actions={
          isAdmin && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Nowy magazyn
            </Button>
          )
        }
      />

      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && data.length === 0 && (
        <EmptyState icon="warehouse" title="Brak magazynów">
          {isAdmin ? 'Dodaj pierwszy magazyn, wgraj jego rzut i zaznacz sektory.' : 'Administrator nie zdefiniował jeszcze magazynów.'}
        </EmptyState>
      )}

      <div className="tiles">
        {data?.map((w) => (
          <Link key={w.id} to={`/warehouses/${w.id}`} className="tile">
            <div className="tile-media">
              {w.floor_plan ? <img src={apiUrl(w.floor_plan.url)} alt="" loading="lazy" /> : <Icon name="map" size={40} />}
            </div>
            <div className="tile-body">
              <div className="tile-title">
                <span className="badge">{w.code}</span> {w.name}
              </div>
              {w.address && <div className="tile-meta">{w.address}</div>}
              <div className="tile-meta">Sektory: {w.sectors_count ?? 0}</div>
            </div>
          </Link>
        ))}
      </div>

      {creating && (
        <WarehouseFormModal onClose={() => setCreating(false)} onSaved={(w) => navigate(`/warehouses/${w.id}`)} />
      )}
    </>
  )
}
