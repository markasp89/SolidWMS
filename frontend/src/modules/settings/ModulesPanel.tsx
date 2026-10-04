import { useState } from 'react'
import { api } from '@/core/api/client'
import { useModuleRegistry } from '@/core/modules/registry'
import type { ModuleState } from '@/core/modules/types'
import { useFeedback } from '@/core/ui/feedback'
import { Card } from '@/core/ui/misc'

/** Switches optional modules on and off (stored on the server, applies to everyone). */
export function ModulesPanel() {
  const { states, setStates } = useModuleRegistry()
  const { toast } = useFeedback()
  const [busy, setBusy] = useState<string | null>(null)

  const names = new Map(states.map((s) => [s.key, s.name]))
  const groups = new Map<string, ModuleState[]>()
  for (const state of states) {
    const group = state.required ? 'Podstawowe (zawsze włączone)' : state.group
    groups.set(group, [...(groups.get(group) ?? []), state])
  }

  const toggle = async (state: ModuleState) => {
    setBusy(state.key)
    try {
      setStates(await api.patch<ModuleState[]>(`/modules/${state.key}`, { enabled: !state.enabled }))
      toast(`Moduł „${state.name}” ${state.enabled ? 'wyłączony' : 'włączony'}.`)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card title="Moduły" className="modules-card">
      <p className="muted">
        Wyłączony moduł znika z menu i aplikacji dla wszystkich użytkowników. Jego dane zostają w bazie, więc po ponownym
        włączeniu wszystko wraca.
      </p>
      {[...groups.entries()].map(([group, list]) => (
        <section key={group} className="module-group">
          <h3>{group}</h3>
          <ul className="module-list">
            {list.map((state) => (
              <li key={state.key} className={`module-item ${state.enabled ? '' : 'is-off'}`}>
                <div className="module-info">
                  <strong>{state.name}</strong>
                  {state.description && <div className="muted">{state.description}</div>}
                  {state.depends.length > 0 && (
                    <div className="module-depends">Wymaga: {state.depends.map((d) => names.get(d) ?? d).join(', ')}</div>
                  )}
                </div>
                <label className="switch" title={state.required ? 'Moduł podstawowy' : undefined}>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={state.enabled}
                    disabled={state.required || busy !== null}
                    onChange={() => toggle(state)}
                    aria-label={`${state.name}: ${state.enabled ? 'włączony' : 'wyłączony'}`}
                  />
                  <span className="switch-track" aria-hidden="true" />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Card>
  )
}
