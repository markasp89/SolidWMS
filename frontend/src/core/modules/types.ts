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
 * A frontend module. Modules never import each other's pages; they can
 * contribute UI to other modules through named extension points.
 */
export interface AppModule {
  id: string
  name: string
  description?: string
  routes?: ModuleRoute[]
  publicRoutes?: ModuleRoute[]
  nav?: ModuleNavItem[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extensions?: Record<string, ComponentType<any>>
}
