import type { AppModule } from '@/core/modules/types'
import { UsersPage } from './UsersPage'

export const usersModule: AppModule = {
  id: 'users',
  name: 'Użytkownicy',
  routes: [{ path: '/users', element: <UsersPage />, roles: ['admin'] }],
  nav: [{ to: '/users', label: 'Użytkownicy', icon: 'users', roles: ['admin'], order: 80 }],
}
