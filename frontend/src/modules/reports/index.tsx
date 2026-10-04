import type { AppModule } from '@/core/modules/types'
import { ReportsPage } from './pages/ReportsPage'
import './reports.css'

export const reportsModule: AppModule = {
  key: 'reports',
  routes: [{ path: '/reports', element: <ReportsPage />, roles: ['admin', 'manager'] }],
  nav: [{ to: '/reports', label: 'Raporty', icon: 'chart', roles: ['admin', 'manager'], order: 70 }],
}

// Public API of the module for other modules.
export { reportsApi } from './api'
export { downloadCsv, toCsv } from './csv'
export type { ActivityRow, OccupancyRow, RotationRow } from './types'
