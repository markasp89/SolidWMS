import type { AppModule } from '@/core/modules/types'
import { SectorStockBadges } from './extensions/SectorStockBadges'
import { SectorStockPanel } from './extensions/SectorStockPanel'
import { MovementsPage } from './pages/MovementsPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { ProductsPage } from './pages/ProductsPage'
import { SearchPage } from './pages/SearchPage'

export const inventoryModule: AppModule = {
  id: 'inventory',
  name: 'Produkty i stany',
  description: 'Produkty, ich lokalizacje w sektorach, wyszukiwarka i historia operacji.',
  routes: [
    { path: '/search', element: <SearchPage /> },
    { path: '/products', element: <ProductsPage /> },
    { path: '/products/:id', element: <ProductDetailPage /> },
    { path: '/movements', element: <MovementsPage /> },
  ],
  nav: [
    { to: '/search', label: 'Gdzie jest?', icon: 'search', order: 10 },
    { to: '/products', label: 'Produkty', icon: 'box', order: 30 },
    { to: '/movements', label: 'Historia', icon: 'history', order: 40 },
  ],
  extensions: {
    'warehouse.sectorPanel': SectorStockPanel,
    'warehouse.mapOverlay': SectorStockBadges,
  },
}

export { inventoryApi } from './api'
export { MovementList } from './components/MovementList'
export type { Movement, Product } from './types'
