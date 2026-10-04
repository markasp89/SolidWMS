/**
 * Tiny pattern router ("/warehouses/:id/sectors") with the per-route checks the
 * Laravel middleware does: module switched on, authenticated, role.
 */
import { HttpError, isObject, notFound, type Body, type DemoResponse } from './http'
import type { Role, UserRow } from './types'

export interface DemoRequest {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
  token: string | null
}

export class Ctx {
  readonly method: string
  readonly path: string
  readonly params: Record<string, string>
  readonly query: URLSearchParams
  /** JSON body (empty object for none / multipart). */
  readonly body: Body
  /** Multipart body, if any. */
  readonly form: FormData | null
  readonly token: string | null
  private readonly currentUser: UserRow | null

  constructor(req: DemoRequest, params: Record<string, string>, user: UserRow | null) {
    this.method = req.method
    this.path = req.path
    this.params = params
    this.query = req.query
    this.form = req.body instanceof FormData ? req.body : null
    this.body = isObject(req.body) ? req.body : {}
    this.token = req.token
    this.currentUser = user
  }

  /** The authenticated user (routes are authenticated unless marked public). */
  get user(): UserRow {
    if (!this.currentUser) throw new HttpError(401, 'Unauthenticated.')
    return this.currentUser
  }

  /** Numeric route parameter; anything else is a 404 like a failed model binding. */
  id(name = 'id'): number {
    const raw = this.params[name] ?? ''
    if (!/^\d+$/.test(raw)) throw notFound()
    return Number(raw)
  }

  /** Query string value with Laravel's `filled` semantics. */
  q(name: string): string | null {
    const value = this.query.get(name)
    return value === null || value.trim() === '' ? null : value.trim()
  }

  qInt(name: string): number | null {
    const value = this.q(name)
    if (value === null) return null
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }
}

export type Handler = (ctx: Ctx) => DemoResponse | Promise<DemoResponse>

export interface RouteOptions {
  /** Optional module that must be switched on (else 404). */
  module?: string
  /** Allowed roles (else 403). */
  roles?: Role[]
  /** No authentication required. */
  public?: boolean
}

interface Route extends RouteOptions {
  methods: string[]
  regex: RegExp
  keys: string[]
  handler: Handler
}

export type RouteMatch = { route: Route; params: Record<string, string> }

export class Router {
  private readonly routes: Route[]
  private readonly defaults: RouteOptions

  constructor(routes: Route[] = [], defaults: RouteOptions = {}) {
    this.routes = routes
    this.defaults = defaults
  }

  /** Sub-router whose routes share the given options. */
  with(options: RouteOptions): Router {
    return new Router(this.routes, { ...this.defaults, ...options })
  }

  add(methods: string | string[], pattern: string, handler: Handler, options: RouteOptions = {}): this {
    const keys: string[] = []
    const source = pattern
      .split('/')
      .map((part) => {
        if (part.startsWith(':')) {
          keys.push(part.slice(1))
          return '([^/]+)'
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      })
      .join('/')
    this.routes.push({
      ...this.defaults,
      ...options,
      methods: (Array.isArray(methods) ? methods : [methods]).map((m) => m.toUpperCase()),
      regex: new RegExp(`^${source}/?$`),
      keys,
      handler,
    })
    return this
  }

  get(pattern: string, handler: Handler, options?: RouteOptions): this {
    return this.add('GET', pattern, handler, options)
  }

  post(pattern: string, handler: Handler, options?: RouteOptions): this {
    return this.add('POST', pattern, handler, options)
  }

  put(pattern: string, handler: Handler, options?: RouteOptions): this {
    return this.add('PUT', pattern, handler, options)
  }

  patch(pattern: string, handler: Handler, options?: RouteOptions): this {
    return this.add('PATCH', pattern, handler, options)
  }

  delete(pattern: string, handler: Handler, options?: RouteOptions): this {
    return this.add('DELETE', pattern, handler, options)
  }

  /** Finds the route; throws 404 / 405 like Laravel when nothing matches. */
  match(method: string, path: string): RouteMatch {
    let pathMatched = false
    for (const route of this.routes) {
      const found = route.regex.exec(path)
      if (!found) continue
      pathMatched = true
      if (!route.methods.includes(method.toUpperCase())) continue
      const params: Record<string, string> = {}
      route.keys.forEach((key, index) => {
        params[key] = safeDecode(found[index + 1] ?? '')
      })
      return { route, params }
    }
    if (pathMatched) throw new HttpError(405, `Metoda ${method.toUpperCase()} nie jest obsługiwana dla tego adresu.`)
    throw notFound()
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
