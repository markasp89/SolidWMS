import type { AppModule } from '@/core/modules/types'
import { SectorStockBadges } from './extensions/SectorStockBadges'
import { SectorStockPanel } from './extensions/SectorStockPanel'
import { MovementsPage } from './pages/MovementsPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { ProductsPage } from './pages/ProductsPage'
import { SearchPage } from './pages/SearchPage'

export const inventoryModule: AppModule = {
  key: 'inventory',
  routes: [
    { path: '/search', element: <SearchPage /> },
    { path: '/products', element: <ProductsPage /> },
    { path: '/products/:id', element: <ProductDetailPage /> },
    { path: '/movements', element: <MovementsPage /> },
  ],
  nav: [
    { to: '/search', label: 'Gdzie jest?', icon: 'search', order: 10 },
    { to: '/products', label: 'Produkty', icon: 'box', order: 30 },
    { to: '/movements', label: 'Historia', icon: 'history', order: 90 },
  ],
  extensions: {
    'warehouse.sectorPanel': SectorStockPanel,
    'warehouse.mapOverlay': SectorStockBadges,
  },
}

// Public API of the module for other modules.
export { inventoryApi, isDeleted } from './api'
export { ExpiryBadge } from './components/ExpiryBadge'
export { LocationList } from './components/LocationList'
export { LocationsMap } from './components/LocationsMap'
export { MovementList } from './components/MovementList'
export { ProductPicker } from './components/ProductPicker'
export { loadSectorsCached, SectorSelect } from './components/SectorSelect'
export { DimensionFields, describeLocation, ReceiveModal } from './components/StockModals'
export { notifyStockChanged, useStockVersion } from './stockEvents'
export type { LocationDimensions, Movement, Product, SectorSummary, StockItem } from './types'
