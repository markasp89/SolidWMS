import type { AppModule } from '@/core/modules/types'
import { LowStockWidget } from './LowStockWidget'
import { MinimumStockCard } from './MinimumStockCard'
import { NotificationsBell } from './NotificationsBell'

export const alertsModule: AppModule = {
  key: 'alerts',
  extensions: {
    'topbar.actions': NotificationsBell,
    'product.sidebar': MinimumStockCard,
    'dashboard.widgets': LowStockWidget,
  },
}
