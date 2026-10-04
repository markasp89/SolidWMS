import { useState } from 'react'
import { isQueued } from '@/core/api/client'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { EmptyState, ErrorMessage, Spinner } from '@/core/ui/misc'
import type { Sector, Warehouse } from '@/modules/warehouses'
import { inventoryApi } from '../api'
import { LocationList } from '../components/LocationList'
import { ReceiveModal } from '../components/StockModals'
import { notifyStockChanged, useStockVersion } from '../stockEvents'

/** Extension point "warehouse.sectorPanel": what is stored in the selected sector. */
export function SectorStockPanel({ sector }: { warehouse: Warehouse; sector: Sector }) {
  const version = useStockVersion()
  const { toast } = useFeedback()
  const [adding, setAdding] = useState(false)
  const { data, error, loading, reload } = useAsync(
    (signal) => inventoryApi.stock({ sector_id: sector.id }, signal),
    [sector.id, version],
  )

  return (
    <div className="sector-stock">
      <div className="sector-stock-header">
        <h3>Towar w sektorze</h3>
        <Button size="sm" variant="primary" icon="plus" onClick={() => setAdding(true)}>
          Dodaj towar
        </Button>
      </div>
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && data.length === 0 && <EmptyState title="Sektor jest pusty" />}
      {data && data.length > 0 && <LocationList items={data} show="product" onChanged={notifyStockChanged} />}

      {adding && (
        <ReceiveModal
          sectorId={sector.id}
          sectorLabel={sector.code}
          onClose={() => setAdding(false)}
          onDone={(result) => {
            setAdding(false)
            toast(isQueued(result) ? 'Brak sieci – operacja czeka w kolejce.' : 'Towar dodany do sektora.', isQueued(result) ? 'info' : 'success')
            notifyStockChanged()
          }}
        />
      )}
    </div>
  )
}
