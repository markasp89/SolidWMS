import type { AppModule } from '@/core/modules/types'
import { authModule } from '@/modules/auth'
import { dashboardModule } from '@/modules/dashboard'
import { inventoryModule } from '@/modules/inventory'
import { settingsModule } from '@/modules/settings'
import { usersModule } from '@/modules/users'
import { warehousesModule } from '@/modules/warehouses'

/**
 * Enabled frontend modules. Remove an entry to disable a module
 * (its routes, menu items and extensions disappear).
 */
export const modules: AppModule[] = [
  authModule,
  dashboardModule,
  warehousesModule,
  inventoryModule,
  usersModule,
  settingsModule,
]
