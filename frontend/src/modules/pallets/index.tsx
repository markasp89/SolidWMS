import type { AppModule } from '@/core/modules/types'
import { PalletPage } from './PalletPage'
import { PalletsInSector } from './PalletsInSector'
import { PalletsPage } from './PalletsPage'
import './pallets.css'

export const palletsModule: AppModule = {
  key: 'pallets',
  routes: [
    { path: '/pallets', element: <PalletsPage /> },
    { path: '/pallets/:code', element: <PalletPage /> },
  ],
  nav: [{ to: '/pallets', label: 'Palety', icon: 'pallet', order: 32 }],
  extensions: {
    'warehouse.sectorPanel': PalletsInSector,
  },
}
