import type { ComponentType, ReactNode } from 'react'
import type { Role } from '@/core/auth/types'
import type { IconName } from '@/core/ui/Icon'

export interface ModuleRoute {
  path: string
  element: ReactNode
  /** Restrict the route to these roles (default: every logged in user). */
  roles?: Role[]
}

export interface ModuleNavItem {
  to: string
  label: string
  icon: IconName
  roles?: Role[]
  /** Lower numbers are shown first. */
  order?: number
}

/**
 * A frontend module. `key` matches the backend module key (config/modules.php);
 * the module is only active when the backend reports it as enabled.
 *
 * Modules never import each other's pages; they contribute UI to other modules
 * through named extension points (see <Extension>).
 */
export interface AppModule {
  key: string
  routes?: ModuleRoute[]
  publicRoutes?: ModuleRoute[]
  nav?: ModuleNavItem[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extensions?: Record<string, ComponentType<any>>
  /** Runs once when the module becomes active (e.g. registering a service worker). */
  activate?: () => void
  /** Runs when the server reports the module as switched off (e.g. unregistering a service worker). */
  deactivate?: () => void
}

/** Module state reported by the API (GET /api/modules). */
export interface ModuleState {
  key: string
  name: string
  description: string | null
  group: string
  required: boolean
  depends: string[]
  enabled: boolean
}
