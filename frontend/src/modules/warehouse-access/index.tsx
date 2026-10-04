import type { AppModule } from '@/core/modules/types'
import { UserWarehousesAction } from './UserWarehousesAction'

export const warehouseAccessModule: AppModule = {
  key: 'warehouse_access',
  extensions: {
    'user.actions': UserWarehousesAction,
  },
}
