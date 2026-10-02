import { useAsync } from '@/core/hooks/useAsync'
import { centroid, type FloorPlanOverlayProps } from '@/modules/warehouses'
import { inventoryApi } from '../api'
import { useStockVersion } from '../stockEvents'

/** Extension point "warehouse.mapOverlay": number of products stored in each sector. */
export function SectorStockBadges({ warehouse, sectors, width, height, unit }: FloorPlanOverlayProps) {
  const version = useStockVersion()
  const { data } = useAsync((signal) => inventoryApi.warehouseSummary(warehouse.id, signal), [warehouse.id, version])

  if (!data) return null
  const counts = new Map(data.map((row) => [row.sector_id, row.products_count]))
  const r = 11 * unit
  const fontSize = 11 * unit

  return (
    <g className="plan-badges" pointerEvents="none">
      {sectors.map((sector) => {
        const count = counts.get(sector.id)
        if (!count || !sector.shape) return null
        const [cx, cy] = centroid(sector.shape)
        // Next to the sector code label (see FloorPlan).
        const labelSize = Math.max(11 * unit, Math.min(width, height) / 45)
        const x = cx * width + labelSize * (sector.code.length * 0.38 + 0.4) + r
        const y = cy * height
        return (
          <g key={sector.id}>
            <circle cx={x} cy={y} r={r} className="plan-badge" strokeWidth={1.5 * unit} />
            <text x={x} y={y} fontSize={fontSize} className="plan-badge-text">
              {count}
            </text>
          </g>
        )
      })}
    </g>
  )
}
