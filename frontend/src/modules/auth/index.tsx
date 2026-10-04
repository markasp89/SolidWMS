import type { AppModule } from '@/core/modules/types'
import { LoginPage } from './LoginPage'

export const authModule: AppModule = {
  key: 'auth',
  publicRoutes: [{ path: '/login', element: <LoginPage /> }],
}
