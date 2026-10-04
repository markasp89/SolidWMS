import type { AppModule } from '@/core/modules/types'
import { IntegrationsPage } from './IntegrationsPage'
import './integrations.css'

export const integrationsModule: AppModule = {
  key: 'integrations',
  routes: [{ path: '/integrations', element: <IntegrationsPage />, roles: ['admin'] }],
  nav: [{ to: '/integrations', label: 'Integracje', icon: 'plug', roles: ['admin'], order: 85 }],
}
