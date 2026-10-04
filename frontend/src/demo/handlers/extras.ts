/**
 * Smaller optional modules: alerts, batches, suggestions and photos.
 */
import { db, nextId, now, nowIso } from '../db'
import { forbidden, HttpError, json, localDate, MAX_QTY, MESSAGES, noContent, Validator } from '../http'
import { readImage } from '../images'
import { productTotal, sectorSummary, stockItemResource } from '../present'
import { allowedWarehouseIds, byName, canAccess, findOr404, sectorById, userRef } from '../repo'
import type { Ctx, Router } from '../router'
import type { PhotoRow, PhotoSubject } from '../types'

export function registerExtras(router: Router): void {
  // Alerts -----------------------------------------------------------------------
  const alerts = router.with({ module: 'alerts' })

  alerts.get('/alerts/low-stock', () =>
    json(
      db()
        .products.filter((p) => p.min_quantity !== null && productTotal(p.id) < (p.min_quantity ?? 0))
        .sort((a, b) => byName(a.name, b.name))
        .map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          total_quantity: productTotal(p.id),
          min_quantity: p.min_quantity ?? 0,
        })),
    ),
  )

  alerts.get('/products/:id/min-quantity', (ctx) => {
    const product = findOr404(db().products, ctx.id())
    return json({ product_id: product.id, min_quantity: product.min_quantity, total_quantity: productTotal(product.id) })
  })

  alerts.put(
    '/products/:id/min-quantity',
    (ctx) => {
      const product = findOr404(db().products, ctx.id())
      const v = new Validator(ctx.body)
      if (!v.has('min_quantity')) v.fail('min_quantity', MESSAGES.required('min_quantity'))
      const minimum = v.number('min_quantity', { gte0: true, max: MAX_QTY })
      v.validate()
      product.min_quantity = typeof minimum === 'number' ? minimum : null
      product.updated_at = nowIso()
      return json({ product_id: product.id, min_quantity: product.min_quantity, total_quantity: productTotal(product.id) })
    },
    { roles: ['admin', 'manager'] },
  )

  alerts.get('/notifications', (ctx) => json(notifications(ctx)))

  alerts.post('/notifications/read', (ctx) => {
    const v = new Validator(ctx.body)
    const ids = v.array('ids')
    v.validate()
    const wanted = ids ? ids.map(String) : null
    const time = nowIso()
    for (const n of db().notifications) {
      if (n.user_id === ctx.user.id && n.read_at === null && (!wanted || wanted.length === 0 || wanted.includes(n.id))) n.read_at = time
    }
    return json(notifications(ctx))
  })

  // Batches ------------------------------------------------------------------------
  router.get(
    '/batches/expiring',
    (ctx) => {
      const days = Math.min(Math.max(ctx.qInt('days') ?? 30, 0), 365)
      const limit = new Date(now().getTime())
      limit.setDate(limit.getDate() + days)
      const until = localDate(limit)
      const allowed = allowedWarehouseIds(ctx.user)
      const warehouseId = ctx.qInt('warehouse_id')
      const rows = db()
        .stock.filter((item) => {
          const warehouse = sectorById(item.sector_id)?.warehouse_id
          return (
            item.expires_at !== null &&
            item.expires_at <= until &&
            canAccess(allowed, warehouse) &&
            (warehouseId === null || warehouse === warehouseId)
          )
        })
        .sort((a, b) => ((a.expires_at ?? '') < (b.expires_at ?? '') ? -1 : (a.expires_at ?? '') > (b.expires_at ?? '') ? 1 : a.id - b.id))
        .slice(0, 500)
      return json(rows.map(stockItemResource))
    },
    { module: 'batches' },
  )

  // Suggestions ----------------------------------------------------------------------
  router.get(
    '/products/:id/suggested-locations',
    (ctx) => {
      const product = findOr404(db().products, ctx.id())
      const allowed = allowedWarehouseIds(ctx.user)
      const suggestions = new Map<string, { sector: ReturnType<typeof sectorSummary>; slot: string | null; quantity: number; reason: string; label: string }>()

      const current = db()
        .stock.filter((i) => i.product_id === product.id && canAccess(allowed, sectorById(i.sector_id)?.warehouse_id))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
      for (const item of current) {
        const key = `${item.sector_id}|${item.slot ?? ''}`
        if (!suggestions.has(key)) {
          suggestions.set(key, { sector: sectorSummary(item.sector_id), slot: item.slot, quantity: item.quantity, reason: 'stored', label: 'Już tu leży' })
        }
      }

      const since = now().getTime() - 90 * 86400000
      const counts = new Map<string, { sectorId: number; slot: string | null; times: number }>()
      for (const m of db().movements) {
        if (m.product_id !== product.id || (m.type !== 'in' && m.type !== 'move') || m.to_sector_id === null) continue
        if (Date.parse(m.created_at) < since) continue
        const key = `${m.to_sector_id}|${m.slot ?? ''}`
        const row = counts.get(key) ?? { sectorId: m.to_sector_id, slot: m.slot, times: 0 }
        row.times++
        counts.set(key, row)
      }
      const history = [...counts.values()].sort((a, b) => b.times - a.times).slice(0, 10)
      for (const row of history) {
        const sector = sectorById(row.sectorId)
        if (!sector || !canAccess(allowed, sector.warehouse_id)) continue
        const key = `${sector.id}|${row.slot ?? ''}`
        if (!suggestions.has(key)) {
          suggestions.set(key, { sector: sectorSummary(sector), slot: row.slot, quantity: 0, reason: 'history', label: `Odkładany tu ${row.times}×` })
        }
      }
      return json([...suggestions.values()].slice(0, 5))
    },
    { module: 'suggestions' },
  )

  // Photos ---------------------------------------------------------------------------
  const photos = router.with({ module: 'photos' })
  const SUBJECTS: readonly PhotoSubject[] = ['product', 'stock_item', 'pallet']

  photos.get('/photos', (ctx) => {
    const v = new Validator({ subject_type: ctx.q('subject_type'), subject_id: ctx.q('subject_id') })
    const type = v.oneOf('subject_type', SUBJECTS, true)
    const id = v.integer('subject_id', true)
    v.validate()
    return json(
      db()
        .photos.filter((p) => p.subject_type === type && p.subject_id === id)
        .sort((a, b) => (a.created_at === b.created_at ? b.id - a.id : a.created_at < b.created_at ? 1 : -1))
        .map(presentPhoto),
    )
  })

  photos.post('/photos', async (ctx) => {
    const form = ctx.form
    const v = new Validator({
      subject_type: form?.get('subject_type') ?? ctx.body.subject_type,
      subject_id: form?.get('subject_id') ?? ctx.body.subject_id,
      caption: form?.get('caption') ?? ctx.body.caption,
    })
    const type = v.oneOf('subject_type', SUBJECTS, true)
    const id = v.integer('subject_id', true)
    const caption = v.string('caption', { max: 255 })
    v.validate()
    const state = db()
    const exists =
      type === 'product'
        ? state.products.some((p) => p.id === id)
        : type === 'stock_item'
          ? state.stock.some((s) => s.id === id)
          : state.pallets.some((p) => p.id === id)
    if (!exists) throw new HttpError(422, 'Nie znaleziono obiektu, do którego dodajesz zdjęcie.')
    const image = await readImage(form, 'photo', 'Plik musi być zdjęciem (JPG, PNG, WEBP lub GIF).')
    const photo: PhotoRow = {
      id: nextId('photos'),
      subject_type: type ?? 'product',
      subject_id: id ?? 0,
      url: image.url,
      width: image.width,
      height: image.height,
      caption: caption ?? null,
      user_id: ctx.user.id,
      created_at: nowIso(),
    }
    state.photos.push(photo)
    return json(presentPhoto(photo), 201)
  })

  photos.delete('/photos/:id', (ctx) => {
    const photo = findOr404(db().photos, ctx.id())
    const user = ctx.user
    if (photo.user_id !== user.id && user.role !== 'admin' && user.role !== 'manager') throw forbidden()
    db().photos = db().photos.filter((p) => p.id !== photo.id)
    return noContent()
  })
}

function notifications(ctx: Ctx) {
  const own = db()
    .notifications.filter((n) => n.user_id === ctx.user.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
  return {
    unread: own.filter((n) => n.read_at === null).length,
    items: own.slice(0, 30).map((n) => ({ id: n.id, data: n.data, read_at: n.read_at, created_at: n.created_at })),
  }
}

function presentPhoto(photo: PhotoRow) {
  return {
    id: photo.id,
    subject_type: photo.subject_type,
    subject_id: photo.subject_id,
    url: photo.url,
    width: photo.width,
    height: photo.height,
    caption: photo.caption,
    user: userRef(photo.user_id),
    created_at: photo.created_at,
  }
}
