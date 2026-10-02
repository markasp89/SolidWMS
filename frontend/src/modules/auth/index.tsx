import type { AppModule } from '@/core/modules/types'
import { LoginPage } from './LoginPage'

export const authModule: AppModule = {
  id: 'auth',
  name: 'Logowanie',
  publicRoutes: [{ path: '/login', element: <LoginPage /> }],
}
