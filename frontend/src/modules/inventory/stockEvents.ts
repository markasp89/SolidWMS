import { useSyncExternalStore } from 'react'

/**
 * Tiny pub/sub so every view showing stock (map badges, sector panel, …)
 * refreshes after a stock operation anywhere on the page.
 */
let version = 0
const listeners = new Set<() => void>()

export function notifyStockChanged() {
  version++
  listeners.forEach((l) => l())
}

export function useStockVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version,
  )
}
