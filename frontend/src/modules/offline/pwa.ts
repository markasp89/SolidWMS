import { setOfflineHandler } from '@/core/api/client'
import { isDemo } from '@/core/demo'
import { enqueue, flush, setOnline } from './queue'

let started = false

/** Installs the offline queue and registers the service worker (app shell + API cache). */
export function startOffline() {
  if (started) return
  started = true

  setOfflineHandler(enqueue)

  window.addEventListener('online', () => {
    setOnline(true)
    void flush()
  })
  window.addEventListener('offline', () => setOnline(false))
  setInterval(() => void flush(), 30_000)
  void flush()

  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  if ('serviceWorker' in navigator && secure && import.meta.env.PROD && !isDemo) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app works without it, just not offline.
    })
  }
}

export function stopOffline() {
  setOfflineHandler(null)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister())).catch(() => {})
  }
}
