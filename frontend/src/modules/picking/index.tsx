import type { AppModule } from '@/core/modules/types'
import { PickListPage } from './pages/PickListPage'
import { PickListsPage } from './pages/PickListsPage'
import './picking.css'

export const pickingModule: AppModule = {
  key: 'picking',
  routes: [
    { path: '/picking', element: <PickListsPage /> },
    { path: '/picking/:id', element: <PickListPage /> },
  ],
  nav: [{ to: '/picking', label: 'Kompletacja', icon: 'list', order: 55 }],
}

// Public API of the module for other modules.
export { pickingApi } from './api'
export type { PickLine, PickListDetail, PickListStatus, PickListSummary } from './types'
