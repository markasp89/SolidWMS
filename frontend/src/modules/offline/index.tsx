import type { AppModule } from '@/core/modules/types'
import { OfflineStatus } from './OfflineStatus'
import { startOffline, stopOffline } from './pwa'

export const offlineModule: AppModule = {
  key: 'offline',
  activate: startOffline,
  deactivate: stopOffline,
  extensions: {
    'topbar.actions': OfflineStatus,
  },
}
