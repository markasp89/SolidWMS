import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatRelative } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { useDebounced } from '@/core/hooks/useDebounced'
import { Button } from '@/core/ui/Button'
import { ColorDot, EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { palletsApi } from './api'
import { NewPalletModal } from './PalletModals'

export function PalletsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const debounced = useDebounced(query.trim())
  const { data, error, loading, reload } = useAsync((signal) => palletsApi.list({ q: debounced }, signal), [debounced])

  return (
    <>
      <PageHeader
        title="Palety"
        subtitle="Każda paleta ma numer i zawartość – przenosisz ją jednym ruchem."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            Nowa paleta
          </Button>
        }
      />
      <input
        className="input input-search"
        type="search"
        placeholder="Numer palety lub produkt na palecie…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && data.data.length === 0 && <EmptyState icon="pallet" title="Brak palet" />}
      <div className="pallet-grid">
        {data?.data.map((p) => (
          <Link key={p.id} to={`/pallets/${encodeURIComponent(p.code)}`} className="pallet-tile">
            <div className="pallet-tile-code">{p.code}</div>
            {p.sector ? (
              <div className="pallet-tile-where">
                <ColorDot color={p.sector.color} /> {p.sector.warehouse?.code} › <strong>{p.sector.code}</strong>
                {p.slot && `-${p.slot}`}
              </div>
            ) : (
              <div className="badge badge-warn">bez miejsca</div>
            )}
            <div className="muted">{p.items_count ? `${p.items_count} pozycji` : 'pusta'}</div>
            {p.note && <div className="pallet-tile-note">{p.note}</div>}
            <div className="location-meta">
              {p.moved_at ? `przeniósł ${p.moved_by?.name ?? '?'}, ${formatRelative(p.moved_at)}` : `utworzona ${formatRelative(p.created_at)}`}
            </div>
          </Link>
        ))}
      </div>

      {creating && (
        <NewPalletModal onClose={() => setCreating(false)} onSaved={(p) => navigate(`/pallets/${encodeURIComponent(p.code)}`)} />
      )}
    </>
  )
}
