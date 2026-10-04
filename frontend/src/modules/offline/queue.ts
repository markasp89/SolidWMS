import { useSyncExternalStore } from 'react'
import { ApiError, rawRequest, type Queued, type QueuedRequest } from '@/core/api/client'

/**
 * Operations made without a connection are stored in localStorage and sent in
 * the original order once the connection is back. Every request carries its
 * Idempotency-Key, so a retry after a lost response is never executed twice.
 */

export interface FailedRequest extends QueuedRequest {
  error: string
}

interface QueueState {
  pending: QueuedRequest[]
  failed: FailedRequest[]
  sending: boolean
  online: boolean
}

const STORAGE_KEY = 'solidwms.offlineQueue'
const listeners = new Set<() => void>()

function load(): Pick<QueueState, 'pending' | 'failed'> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return { pending: raw.pending ?? [], failed: raw.failed ?? [] }
  } catch {
    return { pending: [], failed: [] }
  }
}

let state: QueueState = { ...load(), sending: false, online: typeof navigator === 'undefined' ? true : navigator.onLine }

function set(patch: Partial<QueueState>) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pending: state.pending, failed: state.failed }))
  } catch {
    // Storage full or unavailable.
  }
  listeners.forEach((l) => l())
}

export function enqueue(request: QueuedRequest): Queued {
  set({ pending: [...state.pending, request] })
  return { queued: true, id: request.id }
}

/** Sends queued operations one by one; stops at the first network failure. */
export async function flush(): Promise<void> {
  if (state.sending || state.pending.length === 0) return
  set({ sending: true })
  try {
    while (state.pending.length > 0) {
      const [next] = state.pending
      try {
        await rawRequest(next.path, { method: next.method, body: next.body, idempotencyKey: next.id })
        set({ pending: state.pending.slice(1), online: true })
      } catch (error) {
        if (error instanceof ApiError && error.status !== 0 && error.status < 500) {
          // Rejected by the server (e.g. not enough goods any more) - keep it for the user to see.
          set({ pending: state.pending.slice(1), failed: [...state.failed, { ...next, error: error.message }] })
          continue
        }
        set({ online: !(error instanceof ApiError && error.status === 0) })
        break
      }
    }
  } finally {
    set({ sending: false })
  }
  if (state.pending.length === 0) window.dispatchEvent(new CustomEvent('solidwms:queue-flushed'))
}

export function discard(id: string) {
  set({ pending: state.pending.filter((r) => r.id !== id), failed: state.failed.filter((r) => r.id !== id) })
}

export function setOnline(online: boolean) {
  set({ online })
}

export function useQueue(): QueueState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

/** Human readable description of a queued request. */
export function describe(request: QueuedRequest): string {
  const body = (request.body ?? {}) as Record<string, unknown>
  const qty = body.quantity !== undefined ? ` ${body.quantity}` : ''
  if (request.path === '/stock/receive') return `Przyjęcie${qty}`
  if (request.path.endsWith('/issue')) return `Wydanie${qty}`
  if (request.path.endsWith('/move')) return `Przesunięcie${qty}`
  if (request.path.startsWith('/stock/')) return `Korekta${qty}`
  return `${request.method} ${request.path}`
}
