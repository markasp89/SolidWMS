import type { AppModule } from '@/core/modules/types'
import { WarehouseDetailPage } from './pages/WarehouseDetailPage'
import { WarehouseListPage } from './pages/WarehouseListPage'

export const warehousesModule: AppModule = {
  id: 'warehouses',
  name: 'Magazyny',
  description: 'Magazyny, rzuty z góry i sektory.',
  routes: [
    { path: '/warehouses', element: <WarehouseListPage /> },
    { path: '/warehouses/:id', element: <WarehouseDetailPage /> },
  ],
  nav: [{ to: '/warehouses', label: 'Magazyny', icon: 'warehouse', order: 20 }],
}

// Public API of the module for other modules.
export { FloorPlan } from './components/FloorPlan'
export type { FloorPlanOverlayProps } from './components/FloorPlan'
export { warehousesApi, loadAllSectors } from './api'
export { centroid } from './geometry'
export type { Sector, Warehouse, Point } from './types'
