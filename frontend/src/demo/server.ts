/**
 * In-browser mock of the SolidWMS REST API used by the standalone demo.
 *
 *   handleDemoRequest({ method, path: '/warehouses/1', query, body, token })
 *
 * `path` is the API path without the "/api" prefix. Requests run one at a time;
 * a request that fails leaves the data unchanged (like a database transaction).
 */
import { clearStorage, db, persist, restore, rollback, setDb, snapshot } from './db'
import { registerAdmin } from './handlers/admin'
import { registerDocuments } from './handlers/documents'
import { registerExtras } from './handlers/extras'
import { registerInventory } from './handlers/inventory'
import { registerPallets } from './handlers/pallets'
import { registerPicking } from './handlers/picking'
import { registerStocktaking } from './handlers/stocktaking'
import { registerUsers, userForToken } from './handlers/users'
import { registerWarehouses } from './handlers/warehouses'
import { forbidden, HttpError, type DemoResponse } from './http'
import { moduleEnabled } from './modules'
import { Ctx, Router, type DemoRequest } from './router'
import { createSeed } from './seed'

export type { DemoResponse } from './http'

let router: Router | null = null
let initialized = false
let queue: Promise<unknown> = Promise.resolve()

function getRouter(): Router {
  if (!router) {
    router = new Router()
    registerUsers(router)
    registerWarehouses(router)
    registerInventory(router)
    registerExtras(router)
    registerPallets(router)
    registerStocktaking(router)
    registerDocuments(router)
    registerPicking(router)
    registerAdmin(router)
  }
  return router
}

function ensureInitialized(): void {
  if (initialized) return
  initialized = true
  const stored = restore()
  if (stored) {
    setDb(stored)
  } else {
    setDb(createSeed())
    persist()
  }
}

/** Restores the seed data (sessions of the seeded accounts stay valid). */
export function resetDemo(): void {
  const previous = initialized ? db() : null
  const fresh = createSeed()
  if (previous) {
    fresh.tokens = previous.tokens.filter((t) => {
      const before = previous.users.find((u) => u.id === t.user_id)
      return before !== undefined && fresh.users.some((u) => u.id === t.user_id && u.email === before.email)
    })
  }
  initialized = true
  clearStorage()
  setDb(fresh)
  persist()
}

function normalizePath(path: string): string {
  let clean = path.split('?')[0] ?? ''
  if (!clean.startsWith('/')) clean = `/${clean}`
  if (clean === '/api' || clean.startsWith('/api/')) clean = clean.slice(4) || '/'
  return clean.length > 1 ? clean.replace(/\/+$/, '') : clean
}

async function execute(req: DemoRequest): Promise<DemoResponse> {
  ensureInitialized()
  const method = req.method.toUpperCase()
  const path = normalizePath(req.path)
  const writes = method !== 'GET' && method !== 'HEAD'
  const saved = writes ? snapshot() : null

  try {
    const { route, params } = getRouter().match(method, path)
    if (route.module && !moduleEnabled(route.module)) throw new HttpError(404, 'Moduł jest wyłączony.')
    const user = userForToken(req.token)
    if (!route.public && !user) throw new HttpError(401, 'Unauthenticated.')
    if (route.roles && (!user || !route.roles.includes(user.role))) throw forbidden()

    const response = await route.handler(new Ctx({ ...req, method, path }, params, user))
    if (writes) persist()
    // Detach the body from the live state (and make sure it is plain JSON).
    return response.body === undefined ? { status: response.status } : { status: response.status, body: JSON.parse(JSON.stringify(response.body)) as unknown }
  } catch (error) {
    if (saved !== null) rollback(saved)
    if (error instanceof HttpError) return error.toResponse()
    console.error('[SolidWMS demo]', error)
    return { status: 500, body: { message: 'Wystąpił błąd serwera.' } }
  }
}

export function handleDemoRequest(req: {
  method: string
  path: string
  query: URLSearchParams
  body: unknown | FormData
  token: string | null
}): Promise<DemoResponse> {
  const run = queue.then(() => execute(req))
  queue = run.catch(() => undefined)
  return run
}
