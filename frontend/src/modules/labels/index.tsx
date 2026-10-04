import type { AppModule } from '@/core/modules/types'
import { LabelsPage } from './LabelsPage'
import { SectorLabelAction } from './SectorLabelAction'
import './labels.css'

export const labelsModule: AppModule = {
  key: 'labels',
  routes: [{ path: '/labels', element: <LabelsPage /> }],
  nav: [{ to: '/labels', label: 'Etykiety QR', icon: 'qr', order: 75 }],
  extensions: {
    'sector.actions': SectorLabelAction,
  },
}
