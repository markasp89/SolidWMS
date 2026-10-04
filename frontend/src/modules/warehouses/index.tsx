import type { AppModule } from '@/core/modules/types'
import { SectorRedirect } from './pages/SectorRedirect'
import { WarehouseDetailPage } from './pages/WarehouseDetailPage'
import { WarehouseListPage } from './pages/WarehouseListPage'

export const warehousesModule: AppModule = {
  key: 'warehouses',
  routes: [
    { path: '/warehouses', element: <WarehouseListPage /> },
    { path: '/warehouses/:id', element: <WarehouseDetailPage /> },
    { path: '/sectors/:id', element: <SectorRedirect /> },
  ],
  nav: [{ to: '/warehouses', label: 'Magazyny', icon: 'warehouse', order: 20 }],
}

// Public API of the module for other modules.
export { FloorPlan } from './components/FloorPlan'
export type { FloorPlanOverlayProps } from './components/FloorPlan'
export { warehousesApi, loadAllSectors } from './api'
export { centroid } from './geometry'
export type { Floor, Sector, Warehouse, Point } from './types'
