import type { AppModule } from '@/core/modules/types'
import { SettingsPage } from './SettingsPage'

export const settingsModule: AppModule = {
  id: 'settings',
  name: 'Ustawienia',
  description: 'Eksport i import danych (JSON).',
  routes: [{ path: '/settings', element: <SettingsPage />, roles: ['admin'] }],
  nav: [{ to: '/settings', label: 'Ustawienia', icon: 'settings', roles: ['admin'], order: 90 }],
}
