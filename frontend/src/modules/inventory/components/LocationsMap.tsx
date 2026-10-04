import { Link } from 'react-router-dom'
import { useAsync } from '@/core/hooks/useAsync'
import { Spinner } from '@/core/ui/misc'
import { FloorPlan, warehousesApi } from '@/modules/warehouses'
import type { StockItem } from '../types'

/** Floor plans of every warehouse holding the given locations, with those sectors highlighted. */
export function LocationsMap({ items }: { items: StockItem[] }) {
  const warehouseIds = [...new Set(items.map((i) => i.sector?.warehouse?.id).filter((id): id is number => !!id))]
  const key = warehouseIds.join(',')
  const { data, loading } = useAsync(
    (signal) => Promise.all(warehouseIds.map((id) => warehousesApi.get(id, signal))),
    [key],
  )

  if (warehouseIds.length === 0) return null
  if (loading && !data) return <Spinner label="Ładowanie mapy…" />

  return (
    <div className="locations-maps">
      {data?.map((warehouse) => {
        const highlight = items.filter((i) => i.sector?.warehouse?.id === warehouse.id).map((i) => i.sector_id)
        return (
          <figure key={warehouse.id} className="locations-map">
            <FloorPlan warehouse={warehouse} sectors={warehouse.sectors ?? []} highlightIds={highlight} compact />
            <figcaption>
              <Link to={`/warehouses/${warehouse.id}?highlight=${highlight.join(',')}`}>
                {warehouse.code} – {warehouse.name}
              </Link>
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}
