import type { AppModule } from '@/core/modules/types'
import { DashboardPage } from './DashboardPage'

export const dashboardModule: AppModule = {
  id: 'dashboard',
  name: 'Pulpit',
  routes: [{ path: '/', element: <DashboardPage /> }],
  nav: [{ to: '/', label: 'Pulpit', icon: 'dashboard', order: 0 }],
}
