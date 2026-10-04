import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { useStockVersion } from '@/modules/inventory'
import type { Sector, Warehouse } from '@/modules/warehouses'
import { palletsApi } from './api'
import { NewPalletModal } from './PalletModals'

/** Extension "warehouse.sectorPanel": pallets standing in the selected sector. */
export function PalletsInSector({ sector }: { warehouse: Warehouse; sector: Sector }) {
  const navigate = useNavigate()
  const version = useStockVersion()
  const [creating, setCreating] = useState(false)
  const { data } = useAsync((signal) => palletsApi.list({ sector_id: sector.id }, signal), [sector.id, version])
  const pallets = data?.data ?? []

  return (
    <div className="sector-pallets">
      <div className="sector-stock-header">
        <h3>Palety ({pallets.length})</h3>
        <Button size="sm" icon="plus" onClick={() => setCreating(true)}>
          Nowa paleta
        </Button>
      </div>
      {pallets.length > 0 && (
        <ul className="chips">
          {pallets.map((p) => (
            <li key={p.id}>
              <Link to={`/pallets/${encodeURIComponent(p.code)}`} className="chip">
                {p.code}
                {p.slot && <small>{p.slot}</small>}
                <small>{p.items_count} poz.</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <NewPalletModal
          sectorId={sector.id}
          onClose={() => setCreating(false)}
          onSaved={(p) => navigate(`/pallets/${encodeURIComponent(p.code)}`)}
        />
      )}
    </div>
  )
}
