import type { AppModule } from '@/core/modules/types'
import { alertsModule } from '@/modules/alerts'
import { authModule } from '@/modules/auth'
import { batchesModule } from '@/modules/batches'
import { dashboardModule } from '@/modules/dashboard'
import { documentsModule } from '@/modules/documents'
import { integrationsModule } from '@/modules/integrations'
import { inventoryModule } from '@/modules/inventory'
import { labelsModule } from '@/modules/labels'
import { offlineModule } from '@/modules/offline'
import { palletsModule } from '@/modules/pallets'
import { photosModule } from '@/modules/photos'
import { pickingModule } from '@/modules/picking'
import { reportsModule } from '@/modules/reports'
import { scanningModule } from '@/modules/scanning'
import { settingsModule } from '@/modules/settings'
import { stocktakingModule } from '@/modules/stocktaking'
import { usersModule } from '@/modules/users'
import { warehouseAccessModule } from '@/modules/warehouse-access'
import { warehousesModule } from '@/modules/warehouses'

/**
 * Frontend modules of the installation. `key` matches the backend module
 * (config/modules.php); whether a module is active is decided at runtime by
 * the administrator in Settings → Modules.
 */
export const modules: AppModule[] = [
  authModule,
  dashboardModule,
  warehousesModule,
  inventoryModule,
  scanningModule,
  labelsModule,
  palletsModule,
  offlineModule,
  batchesModule,
  alertsModule,
  photosModule,
  stocktakingModule,
  documentsModule,
  pickingModule,
  reportsModule,
  warehouseAccessModule,
  integrationsModule,
  usersModule,
  settingsModule,
]
