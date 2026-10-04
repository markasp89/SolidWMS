import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { useDebounced } from '@/core/hooks/useDebounced'
import { Button } from '@/core/ui/Button'
import { Icon } from '@/core/ui/Icon'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { inventoryApi } from '../api'
import { LocationList } from '../components/LocationList'
import { LocationsMap } from '../components/LocationsMap'
import { useStockVersion, notifyStockChanged } from '../stockEvents'
import type { Product } from '../types'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const debounced = useDebounced(query.trim(), 300)
  const version = useStockVersion()

  // Keep the input in sync when searching again from the top bar.
  useEffect(() => setQuery(params.get('q') ?? ''), [params])

  useEffect(() => {
    if (debounced !== (params.get('q') ?? '')) setParams(debounced ? { q: debounced } : {}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const { data, error, loading, reload } = useAsync(
    (signal) => (debounced ? inventoryApi.search(debounced, signal) : Promise.resolve(null)),
    [debounced, version],
  )

  return (
    <>
      <PageHeader title="Gdzie jest…?" subtitle="Wpisz nazwę, SKU lub kod kreskowy – pokażemy, w którym sektorze szukać." />
      <div className="search-hero">
        <Icon name="search" size={22} />
        <input
          type="search"
          autoFocus
          placeholder="np. paleta, KART-40, 5901234…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Szukaj produktu"
        />
      </div>

      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && debounced && !data && <Spinner label="Szukam…" />}
      {data && data.length === 0 && (
        <EmptyState icon="search" title={`Nic nie znaleziono dla „${debounced}”`}>
          Sprawdź pisownię lub <Link to="/products">przejrzyj listę produktów</Link>.
        </EmptyState>
      )}
      <div className="results">
        {data?.map((product) => <SearchResult key={product.id} product={product} expanded={data.length === 1} />)}
      </div>
    </>
  )
}

function SearchResult({ product, expanded }: { product: Product; expanded: boolean }) {
  const [showMap, setShowMap] = useState(expanded)
  const locations = product.locations ?? []

  useEffect(() => setShowMap(expanded), [expanded])

  return (
    <article className="result card">
      <header className="result-header">
        <div>
          <Link to={`/products/${product.id}`} className="result-title">
            {product.name}
          </Link>
          <div className="muted">
            {product.sku}
            {product.barcode && ` · ${product.barcode}`}
          </div>
        </div>
        <div className="result-total">
          {formatNumber(product.total_quantity)} <small>{product.unit}</small>
        </div>
      </header>
      {locations.length === 0 ? (
        <p className="alert alert-warn">Produkt nie ma przypisanej lokalizacji.</p>
      ) : (
        <>
          <LocationList items={locations} show="location" onChanged={notifyStockChanged} />
          <Button size="sm" variant="ghost" icon="map" onClick={() => setShowMap((v) => !v)}>
            {showMap ? 'Ukryj mapę' : 'Pokaż na mapie'}
          </Button>
          {showMap && <LocationsMap items={locations} />}
        </>
      )}
    </article>
  )
}
