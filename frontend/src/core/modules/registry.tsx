import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'
import type { AppModule, ModuleState } from './types'

interface ModulesContextValue {
  /** Modules that are enabled on the server (or all, before the state is known). */
  modules: AppModule[]
  states: ModuleState[]
  loading: boolean
  isEnabled: (key: string) => boolean
  refresh: () => Promise<void>
  setStates: (states: ModuleState[]) => void
}

const ModulesContext = createContext<ModulesContextValue | null>(null)
const CACHE_KEY = 'solidwms.modules'

function cachedStates(): ModuleState[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]') as ModuleState[]
  } catch {
    return []
  }
}

export function ModulesProvider({ modules, children }: { modules: AppModule[]; children: ReactNode }) {
  const { user } = useAuth()
  // The last known state is used immediately (also offline) and refreshed in the background.
  const [states, setStatesRaw] = useState<ModuleState[]>(cachedStates)
  const [loading, setLoading] = useState(() => cachedStates().length === 0)
  const activated = useRef(new Set<string>())

  const setStates = useCallback((next: ModuleState[]) => {
    setStatesRaw(next)
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next))
    } catch {
      // Storage unavailable - the state just is not cached.
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      setStates(await api.get<ModuleState[]>('/modules'))
    } catch {
      // Keep the cached state (e.g. offline).
    } finally {
      setLoading(false)
    }
  }, [setStates])

  useEffect(() => {
    if (user) void refresh()
    else setLoading(false)
  }, [user, refresh])

  const value = useMemo<ModulesContextValue>(() => {
    const known = new Map(states.map((s) => [s.key, s.enabled]))
    // Modules unknown to the server (or before the first response) count as enabled.
    const isEnabled = (key: string) => known.get(key) ?? true
    return {
      modules: modules.filter((m) => isEnabled(m.key)),
      states,
      loading: Boolean(user) && loading,
      isEnabled,
      refresh,
      setStates,
    }
  }, [modules, states, loading, user, refresh, setStates])

  useEffect(() => {
    if (states.length === 0) return
    for (const module of modules) {
      if (module.deactivate && !value.isEnabled(module.key)) module.deactivate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states])

  useEffect(() => {
    for (const module of value.modules) {
      if (module.activate && !activated.current.has(module.key)) {
        activated.current.add(module.key)
        module.activate()
      }
    }
  }, [value.modules])

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>
}

function useModulesContext(): ModulesContextValue {
  const ctx = useContext(ModulesContext)
  if (!ctx) throw new Error('Modules context missing')
  return ctx
}

/** Enabled modules. */
export function useModules(): AppModule[] {
  return useModulesContext().modules
}

export function useModuleRegistry() {
  return useModulesContext()
}

/** Whether a (frontend or backend) module is switched on. */
export function useModuleEnabled(key: string): boolean {
  return useModulesContext().isEnabled(key)
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

/** True when at least one enabled module provides the extension point. */
export function useHasExtension(name: string): boolean {
  return useModules().some((m) => m.extensions?.[name] !== undefined)
}
