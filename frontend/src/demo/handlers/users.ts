/**
 * Auth, Users, Core (modules) and WarehouseAccess endpoints.
 */
import { db, nextId, nowIso } from '../db'
import { randomString } from '../events'
import { invalid, json, MESSAGES, noContent, validationError, Validator } from '../http'
import { listModules, setModule } from '../modules'
import { userResource } from '../present'
import { findOr404 } from '../repo'
import type { Router } from '../router'
import type { Role, UserRow } from '../types'

const ROLES: readonly Role[] = ['admin', 'manager', 'worker']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function issueToken(user: UserRow): string {
  const token = `demo-${user.id}-${randomString(24)}`
  db().tokens.push({ token, user_id: user.id })
  return token
}

/** The active user a bearer token belongs to. */
export function userForToken(token: string | null): UserRow | null {
  if (!token) return null
  const row = db().tokens.find((t) => t.token === token)
  const user = row ? db().users.find((u) => u.id === row.user_id) : undefined
  return user && user.is_active ? user : null
}

export function registerUsers(router: Router): void {
  // Auth ------------------------------------------------------------------
  router.post(
    '/auth/login',
    (ctx) => {
      const v = new Validator(ctx.body)
      const email = v.string('email', { required: true })
      const password = v.string('password', { required: true })
      if (email && !EMAIL.test(email)) v.fail('email', MESSAGES.email('email'))
      v.validate()
      const user = db().users.find((u) => u.email.toLowerCase() === (email ?? '').toLowerCase())
      if (!user || user.password !== password) invalid('email', 'Nieprawidłowy e-mail lub hasło.')
      if (!user.is_active) invalid('email', 'Konto jest nieaktywne.')
      return json({ token: issueToken(user), user: userResource(user) })
    },
    { public: true },
  )
  router.get('/auth/me', (ctx) => json(userResource(ctx.user)))
  router.post('/auth/logout', (ctx) => {
    db().tokens = db().tokens.filter((t) => t.token !== ctx.token)
    return noContent()
  })

  // Modules ------------------------------------------------------------------
  router.get('/modules', () => json(listModules()))
  router.patch(
    '/modules/:key',
    (ctx) => {
      const v = new Validator(ctx.body)
      const enabled = v.boolean('enabled', true)
      v.validate()
      setModule(ctx.params.key ?? '', enabled === true)
      return json(listModules())
    },
    { roles: ['admin'] },
  )

  // Users ------------------------------------------------------------------
  const admin = router.with({ roles: ['admin'] })

  admin.get('/users', () => json([...db().users].sort((a, b) => a.name.localeCompare(b.name, 'pl')).map(userResource)))
  admin.get('/users/:id', (ctx) => json(userResource(findOr404(db().users, ctx.id()))))

  admin.post('/users', (ctx) => {
    const data = validateUser(ctx.body, null)
    const user: UserRow = {
      id: nextId('users'),
      name: data.name ?? '',
      email: data.email ?? '',
      password: data.password ?? '',
      role: data.role ?? 'worker',
      is_active: data.is_active ?? true,
      created_at: nowIso(),
    }
    db().users.push(user)
    return json(userResource(user), 201)
  })

  admin.add(['PUT', 'PATCH'], '/users/:id', (ctx) => {
    const user = findOr404(db().users, ctx.id())
    const data = validateUser(ctx.body, user)
    if (user.id === ctx.user.id) {
      if (data.role !== undefined && data.role !== user.role) invalid('role', 'Nie możesz zmienić własnej roli.')
      if (data.is_active === false) invalid('is_active', 'Nie możesz dezaktywować własnego konta.')
    }
    if (data.name !== undefined) user.name = data.name
    if (data.email !== undefined) user.email = data.email
    if (data.password) user.password = data.password
    if (data.role !== undefined) user.role = data.role
    if (data.is_active !== undefined) user.is_active = data.is_active
    if (!user.is_active) db().tokens = db().tokens.filter((t) => t.user_id !== user.id)
    return json(userResource(user))
  })

  admin.delete('/users/:id', (ctx) => {
    const user = findOr404(db().users, ctx.id())
    if (user.id === ctx.user.id) invalid('user', 'Nie możesz usunąć własnego konta.')
    deleteUser(user.id)
    return noContent()
  })

  // Warehouse access (module "warehouse_access") ---------------------------
  const access = router.with({ roles: ['admin'], module: 'warehouse_access' })

  access.get('/user-warehouses', () => {
    const map: Record<string, number[]> = {}
    for (const row of db().user_warehouse) (map[String(row.user_id)] ??= []).push(row.warehouse_id)
    return json(map)
  })
  access.get('/users/:id/warehouses', (ctx) => {
    const user = findOr404(db().users, ctx.id())
    return json({ warehouse_ids: assignedWarehouses(user.id) })
  })
  access.put('/users/:id/warehouses', (ctx) => {
    const user = findOr404(db().users, ctx.id())
    const v = new Validator(ctx.body)
    if (!v.has('warehouse_ids')) v.fail('warehouse_ids', MESSAGES.required('warehouse_ids'))
    const raw = v.array('warehouse_ids') ?? []
    const ids: number[] = []
    raw.forEach((value, index) => {
      const id = typeof value === 'number' ? value : Number(value)
      if (!Number.isInteger(id) || !db().warehouses.some((w) => w.id === id)) v.fail(`warehouse_ids.${index}`, MESSAGES.exists('warehouse_ids'))
      else if (ids.includes(id)) v.fail(`warehouse_ids.${index}`, 'Magazyny nie mogą się powtarzać.')
      else ids.push(id)
    })
    v.validate()
    const state = db()
    state.user_warehouse = state.user_warehouse.filter((row) => row.user_id !== user.id)
    state.user_warehouse.push(...ids.map((warehouse_id) => ({ user_id: user.id, warehouse_id })))
    return json({ warehouse_ids: assignedWarehouses(user.id) })
  })
}

const assignedWarehouses = (userId: number) => db().user_warehouse.filter((r) => r.user_id === userId).map((r) => r.warehouse_id)

interface UserInput {
  name?: string
  email?: string
  password?: string | null
  role?: Role
  is_active?: boolean
}

function validateUser(body: unknown, user: UserRow | null): UserInput {
  const creating = user === null
  const v = new Validator(body)
  const name = v.string('name', { required: creating, max: 255 })
  const email = v.string('email', { required: creating, max: 255 })
  if (email) {
    if (!EMAIL.test(email)) v.fail('email', MESSAGES.email('email'))
    else if (db().users.some((u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== user?.id)) {
      v.fail('email', 'Ten adres e-mail jest już zajęty.')
    }
  }
  const password = v.string('password', { required: creating })
  if (password && password.length < 8) v.fail('password', 'Hasło musi mieć co najmniej 8 znaków.')
  const role = v.oneOf('role', ROLES, creating)
  const isActive = v.boolean('is_active')
  if (!creating && v.has('name') && name === null) v.fail('name', MESSAGES.required('name'))
  if (!creating && v.has('email') && email === null) v.fail('email', MESSAGES.required('email'))
  if (v.failed) throw validationError(v.errors)
  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    password: password ?? null,
    ...(role ? { role } : {}),
    ...(isActive !== undefined ? { is_active: isActive } : {}),
  }
}

function deleteUser(id: number): void {
  const state = db()
  state.users = state.users.filter((u) => u.id !== id)
  state.tokens = state.tokens.filter((t) => t.user_id !== id)
  state.user_warehouse = state.user_warehouse.filter((r) => r.user_id !== id)
  state.notifications = state.notifications.filter((n) => n.user_id !== id)
  function clear<T>(rows: T[], keys: Array<keyof T>): void {
    for (const row of rows) for (const key of keys) if (row[key] === (id as T[keyof T])) row[key] = null as T[keyof T]
  }
  clear(state.stock, ['updated_by'])
  clear(state.movements, ['user_id'])
  clear(state.pallets, ['created_by', 'moved_by'])
  clear(state.photos, ['user_id'])
  clear(state.stocktakes, ['created_by', 'completed_by'])
  clear(state.stocktake_lines, ['counted_by'])
  clear(state.documents, ['created_by', 'posted_by'])
  clear(state.pick_lists, ['created_by'])
  clear(state.pick_lines, ['picked_by'])
  clear(state.api_keys, ['created_by'])
}
