import { createContext, useContext, type ComponentType, type ReactNode } from 'react'
import type { AppModule } from './types'

const ModulesContext = createContext<AppModule[]>([])

export function ModulesProvider({ modules, children }: { modules: AppModule[]; children: ReactNode }) {
  return <ModulesContext.Provider value={modules}>{children}</ModulesContext.Provider>
}

export function useModules(): AppModule[] {
  return useContext(ModulesContext)
}

/**
 * Renders every component registered by enabled modules for the given extension point.
 *
 *   <Extension name="warehouse.sectorPanel" props={{ sector, warehouse }} />
 */
export function Extension<P extends object>({ name, props }: { name: string; props: P }) {
  const modules = useModules()
  const components = modules
    .map((module) => module.extensions?.[name] as ComponentType<P> | undefined)
    .filter((c): c is ComponentType<P> => c !== undefined)

  return (
    <>
      {components.map((Component, index) => (
        <Component key={index} {...props} />
      ))}
    </>
  )
}
