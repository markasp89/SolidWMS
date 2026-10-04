import type { AppModule } from '@/core/modules/types'
import { SettingsPage } from './SettingsPage'

export const settingsModule: AppModule = {
  key: 'settings',
  routes: [{ path: '/settings', element: <SettingsPage />, roles: ['admin'] }],
  nav: [{ to: '/settings', label: 'Ustawienia', icon: 'settings', roles: ['admin'], order: 90 }],
}
