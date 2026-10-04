import type { AppModule } from '@/core/modules/types'
import { ScanAction } from './ScanAction'

export const scanningModule: AppModule = {
  key: 'scanning',
  extensions: {
    'topbar.actions': ScanAction,
  },
}
