/**
 * Reports, integrations (API keys, webhooks) and settings (export / import).
 */
import { db, nextId, now, nowIso } from '../db'
import { DEMO_PLAN_ASSET } from '../present'
import { randomString, recordDelivery, WEBHOOK_EVENTS } from '../events'
import { dbDateTime, HttpError, json, localDate, MESSAGES, noContent, toDateString, Validator } from '../http'
import { allowedWarehouseIds, byName, canAccess, findOr404, palletById, productById, sectorById, warehouseById } from '../repo'
import type { Ctx, Router } from '../router'
import type { ImageRef, WebhookDeliveryRow, WebhookRow } from '../types'

export function registerAdmin(router: Router): void {
  registerReports(router.with({ module: 'reports', roles: ['admin', 'manager'] }))
  registerIntegrations(router.with({ module: 'integrations', roles: ['admin'] }))
  registerSettings(router.with({ roles: ['admin'] }))
}

// Reports ----------------------------------------------------------------------------

/** [from, to] of the report period (default: last 30 days). */
function period(ctx: Ctx): [Date, Date] {
  const v = new Validator({ from: ctx.q('from'), to: ctx.q('to') })
  const from = v.date('from')
  const to = v.date('to')
  if (from && to && to < from) v.fail('to', 'Data końcowa nie może być wcześniejsza niż początkowa.')
  v.validate()
  const start = from ? parseLocal(from) : addDays(startOfDay(now()), -30)
  const end = to ? parseLocal(to) : startOfDay(now())
  end.setHours(23, 59, 59, 999)
  return [start, end]
}

const parseLocal = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => {
  const copy = new Date(date.getTime())
  copy.setDate(copy.getDate() + days)
  return copy
}

const maxIso = (a: string | null, b: string) => (a === null || b > a ? b : a)

function registerReports(router: Router): void {
  router.get('/reports/occupancy', (ctx) => {
    const allowed = allowedWarehouseIds(ctx.user)
    const warehouseId = ctx.qInt('warehouse_id')
    const rows = db()
      .sectors.filter((s) => canAccess(allowed, s.warehouse_id) && (warehouseId === null || s.warehouse_id === warehouseId))
      .map((sector) => {
        const warehouse = warehouseById(sector.warehouse_id)
        const items = db().stock.filter((i) => i.sector_id === sector.id)
        return {
          sector_id: sector.id,
          warehouse: warehouse?.code ?? '',
          warehouse_name: warehouse?.name ?? '',
          sector: sector.code,
          sector_name: sector.name,
          products_count: new Set(items.map((i) => i.product_id)).size,
          locations_count: items.length,
          total_quantity: Math.round(items.reduce((sum, i) => sum + i.quantity, 0) * 1000) / 1000,
          last_change: dbDateTime(items.reduce<string | null>((max, i) => maxIso(max, i.updated_at), null)),
        }
      })
      .sort((a, b) => (a.warehouse === b.warehouse ? (a.sector < b.sector ? -1 : 1) : a.warehouse < b.warehouse ? -1 : 1))
    return json(rows)
  })

  router.get('/reports/rotation', (ctx) => {
    const [from, to] = period(ctx)
    const inPeriod = db().movements.filter((m) => {
      const time = Date.parse(m.created_at)
      return time >= from.getTime() && time <= to.getTime()
    })
    const rows = db()
      .products.map((p) => {
        const own = inPeriod.filter((m) => m.product_id === p.id)
        const sum = (type: string) => own.filter((m) => m.type === type).reduce((s, m) => s + m.quantity, 0)
        return {
          product_id: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          received: Math.round(sum('in') * 1000) / 1000,
          issued: Math.round(sum('out') * 1000) / 1000,
          moves: own.filter((m) => m.type === 'move').length,
          operations: own.length,
          stock: Math.round(db().stock.filter((i) => i.product_id === p.id).reduce((s, i) => s + i.quantity, 0) * 1000) / 1000,
          last_movement: dbDateTime(own.reduce<string | null>((max, m) => maxIso(max, m.created_at), null)),
        }
      })
      .sort((a, b) => b.issued - a.issued || byName(a.name, b.name))
    return json({ from: localDate(from), to: localDate(to), rows })
  })

  router.get('/reports/activity', (ctx) => {
    const [from, to] = period(ctx)
    const groups = new Map<number | null, { receipts: number; issues: number; moves: number; adjustments: number; operations: number; last: string | null }>()
    for (const m of db().movements) {
      const time = Date.parse(m.created_at)
      if (time < from.getTime() || time > to.getTime()) continue
      const row = groups.get(m.user_id) ?? { receipts: 0, issues: 0, moves: 0, adjustments: 0, operations: 0, last: null }
      if (m.type === 'in') row.receipts++
      if (m.type === 'out') row.issues++
      if (m.type === 'move') row.moves++
      if (m.type === 'adjust') row.adjustments++
      row.operations++
      row.last = maxIso(row.last, m.created_at)
      groups.set(m.user_id, row)
    }
    const rows = [...groups.entries()]
      .map(([userId, row]) => ({
        user_id: userId,
        name: db().users.find((u) => u.id === userId)?.name ?? 'System / usunięty użytkownik',
        receipts: row.receipts,
        issues: row.issues,
        moves: row.moves,
        adjustments: row.adjustments,
        operations: row.operations,
        last_activity: dbDateTime(row.last),
      }))
      .sort((a, b) => b.operations - a.operations)
    return json({ from: localDate(from), to: localDate(to), rows })
  })
}

// Integrations ---------------------------------------------------------------------------

const presentDelivery = (d: WebhookDeliveryRow) => ({ ...d })

function presentWebhook(w: WebhookRow, withSecret = false) {
  const last = db()
    .webhook_deliveries.filter((d) => d.webhook_id === w.id)
    .sort((a, b) => b.id - a.id)[0]
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    events: w.events,
    active: w.active,
    secret: withSecret ? w.secret : null,
    last_delivery: last ? presentDelivery(last) : null,
    created_at: w.created_at,
  }
}

function validateWebhook(ctx: Ctx) {
  const v = new Validator(ctx.body)
  const name = v.string('name', { required: true, max: 100 })
  const url = v.string('url', { required: true, max: 2048 })
  if (url && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) v.fail('url', MESSAGES.url('url'))
  const events = v.array('events', true, 'Wybierz co najmniej jedno zdarzenie.')
  const allowed = [...Object.keys(WEBHOOK_EVENTS), '*']
  events?.forEach((event, index) => {
    if (typeof event !== 'string' || !allowed.includes(event)) v.fail(`events.${index}`, MESSAGES.in('events'))
  })
  const active = v.boolean('active')
  v.validate()
  return { name: name ?? '', url: url ?? '', events: (events ?? []).map(String), ...(active !== undefined ? { active } : {}) }
}

function registerIntegrations(router: Router): void {
  router.get('/integrations/events', () => json(Object.entries(WEBHOOK_EVENTS).map(([key, label]) => ({ key, label }))))

  router.get('/integrations/api-keys', () =>
    json(
      db()
        .api_keys.filter((k) => k.revoked_at === null)
        .sort((a, b) => (a.created_at === b.created_at ? b.id - a.id : a.created_at < b.created_at ? 1 : -1))
        .map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, abilities: k.abilities, last_used_at: k.last_used_at, created_at: k.created_at })),
    ),
  )

  router.post('/integrations/api-keys', (ctx) => {
    const v = new Validator(ctx.body)
    const name = v.string('name', { required: true, max: 100 })
    const abilities = v.array('abilities', true) ?? []
    abilities.forEach((a, index) => {
      if (a !== 'read' && a !== 'write') v.fail(`abilities.${index}`, MESSAGES.in('abilities'))
    })
    v.validate()
    const plain = `swms_${randomString(40)}`
    const key = {
      id: nextId('api_keys'),
      name: name ?? '',
      prefix: plain.slice(0, 12),
      abilities: [...new Set(abilities.map(String))],
      last_used_at: null,
      revoked_at: null,
      created_by: ctx.user.id,
      created_at: nowIso(),
    }
    db().api_keys.push(key)
    return json({ id: key.id, name: key.name, key: plain }, 201)
  })

  router.delete('/integrations/api-keys/:id', (ctx) => {
    findOr404(db().api_keys, ctx.id()).revoked_at = nowIso()
    return noContent()
  })

  router.get('/integrations/webhooks', () =>
    json(
      db()
        .webhooks.slice()
        .sort((a, b) => (a.created_at === b.created_at ? b.id - a.id : a.created_at < b.created_at ? 1 : -1))
        .map((w) => presentWebhook(w)),
    ),
  )

  router.post('/integrations/webhooks', (ctx) => {
    const data = validateWebhook(ctx)
    const time = nowIso()
    const webhook: WebhookRow = { id: nextId('webhooks'), active: true, ...data, secret: randomString(40), created_at: time, updated_at: time }
    db().webhooks.push(webhook)
    return json(presentWebhook(webhook, true), 201)
  })

  router.put('/integrations/webhooks/:id', (ctx) => {
    const webhook = findOr404(db().webhooks, ctx.id())
    Object.assign(webhook, validateWebhook(ctx), { updated_at: nowIso() })
    return json(presentWebhook(webhook))
  })

  router.delete('/integrations/webhooks/:id', (ctx) => {
    const webhook = findOr404(db().webhooks, ctx.id())
    db().webhooks = db().webhooks.filter((w) => w.id !== webhook.id)
    db().webhook_deliveries = db().webhook_deliveries.filter((d) => d.webhook_id !== webhook.id)
    return noContent()
  })

  router.post('/integrations/webhooks/:id/test', (ctx) => {
    const webhook = findOr404(db().webhooks, ctx.id())
    return json(presentDelivery(recordDelivery(webhook.id, 'ping')))
  })

  router.get('/integrations/webhooks/:id/deliveries', (ctx) => {
    const webhook = findOr404(db().webhooks, ctx.id())
    return json(
      db()
        .webhook_deliveries.filter((d) => d.webhook_id === webhook.id)
        .sort((a, b) => b.id - a.id)
        .slice(0, 50)
        .map(presentDelivery),
    )
  })

  router.get('/integrations/webhooks/:id/secret', (ctx) => json({ secret: findOr404(db().webhooks, ctx.id()).secret }))
}

// Settings ------------------------------------------------------------------------------------

function exportImage(image: ImageRef | null) {
  if (!image || image.url === DEMO_PLAN_ASSET) return null
  const match = /^data:([^;,]+);base64,(.*)$/.exec(image.url)
  if (!match) return null
  return { width: image.width, height: image.height, mime: match[1], data: match[2] }
}

function registerSettings(router: Router): void {
  router.get('/settings/export', (ctx) => {
    const includeImages = !['0', 'false', ''].includes(ctx.query.get('include_images') ?? '1')
    const state = db()
    const byCode = (a: { code: string }, b: { code: string }) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
    const floorName = (id: number | null) => state.floors.find((f) => f.id === id)?.name ?? null
    return json({
      format: 'solidwms',
      version: 2,
      exported_at: nowIso(),
      warehouses: [...state.warehouses].sort(byCode).map((w) => ({
        code: w.code,
        name: w.name,
        address: w.address,
        description: w.description,
        floor_plan: includeImages ? exportImage(w.floor_plan) : null,
        floors: state.floors
          .filter((f) => f.warehouse_id === w.id)
          .sort((a, b) => a.level - b.level)
          .map((f) => ({ name: f.name, level: f.level, floor_plan: includeImages ? exportImage(f.floor_plan) : null })),
        sectors: state.sectors
          .filter((s) => s.warehouse_id === w.id)
          .sort(byCode)
          .map((s) => ({
            code: s.code,
            name: s.name,
            color: s.color,
            description: s.description,
            floor: s.floor_id ? floorName(s.floor_id) : null,
            shape: s.shape,
          })),
      })),
      products: [...state.products]
        .sort((a, b) => (a.sku < b.sku ? -1 : 1))
        .map((p) => ({ sku: p.sku, name: p.name, barcode: p.barcode, unit: p.unit, min_quantity: p.min_quantity, description: p.description })),
      pallets: [...state.pallets].sort(byCode).map((p) => {
        const sector = sectorById(p.sector_id)
        return { code: p.code, warehouse_code: warehouseById(sector?.warehouse_id ?? null)?.code ?? null, sector_code: sector?.code ?? null, slot: p.slot, note: p.note }
      }),
      stock: [...state.stock]
        .sort((a, b) => a.id - b.id)
        .map((i) => {
          const sector = sectorById(i.sector_id)
          return {
            sku: productById(i.product_id)?.sku ?? '',
            warehouse_code: warehouseById(sector?.warehouse_id ?? null)?.code ?? '',
            sector_code: sector?.code ?? '',
            slot: i.slot,
            batch: i.batch,
            expires_at: i.expires_at ? toDateString(i.expires_at) : null,
            pallet: palletById(i.pallet_id)?.code ?? null,
            quantity: i.quantity,
            note: i.note,
          }
        }),
    })
  })

  router.post('/settings/import', () => {
    throw new HttpError(422, 'Import jest dostępny w pełnej wersji.')
  })
}
