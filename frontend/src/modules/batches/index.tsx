import type { AppModule } from '@/core/modules/types'
import { ExpiringPage } from './ExpiringPage'
import { ExpiryWidget } from './ExpiryWidget'

export const batchesModule: AppModule = {
  key: 'batches',
  routes: [{ path: '/expiring', element: <ExpiringPage /> }],
  nav: [{ to: '/expiring', label: 'Terminy ważności', icon: 'clock', order: 35 }],
  extensions: {
    'dashboard.widgets': ExpiryWidget,
  },
}
