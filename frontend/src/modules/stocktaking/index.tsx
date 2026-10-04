import type { AppModule } from '@/core/modules/types'
import { StartStocktakeButton } from './extensions/StartStocktakeButton'
import { StocktakeListPage } from './pages/StocktakeListPage'
import { StocktakePage } from './pages/StocktakePage'
import './stocktaking.css'

export const stocktakingModule: AppModule = {
  key: 'stocktaking',
  routes: [
    { path: '/stocktaking', element: <StocktakeListPage /> },
    { path: '/stocktaking/:id', element: <StocktakePage /> },
  ],
  nav: [{ to: '/stocktaking', label: 'Inwentaryzacja', icon: 'clipboard', order: 45 }],
  extensions: {
    'sector.actions': StartStocktakeButton,
  },
}

// Public API of the module for other modules.
export { stocktakingApi } from './api'
export type { Stocktake, StocktakeDetail, StocktakeLine, StocktakeStatus } from './types'
