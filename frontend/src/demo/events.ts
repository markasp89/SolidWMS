/**
 * Domain events: low stock notifications (module "alerts") and webhook
 * deliveries (module "integrations" - the demo records them without sending).
 */
import { db, nextId, nowIso } from './db'
import { formatQuantity } from './http'
import { moduleEnabled } from './modules'
import { productTotal } from './present'
import { productById } from './repo'

export const WEBHOOK_EVENTS: Record<string, string> = {
  'stock.movement': 'Każda zmiana stanu (przyjęcie, wydanie, przesunięcie, korekta)',
  'product.saved': 'Dodanie lub zmiana produktu',
  'product.deleted': 'Usunięcie produktu',
  'pallet.moved': 'Przeniesienie palety',
  'document.posted': 'Zatwierdzenie dokumentu PZ/WZ',
  'stocktake.completed': 'Zakończenie inwentaryzacji',
  'picking.completed': 'Zakończenie kompletacji',
}

export const DEMO_DELIVERY_ERROR = 'Wersja demo nie wysyła żądań HTTP.'

export function randomId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    try {
      return cryptoApi.randomUUID()
    } catch {
      // insecure context
    }
  }
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`
}

export function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

/** Records a delivery for a webhook (the demo never performs HTTP requests). */
export function recordDelivery(webhookId: number, event: string) {
  const delivery = {
    id: nextId('webhook_deliveries'),
    webhook_id: webhookId,
    event,
    status_code: null,
    error: DEMO_DELIVERY_ERROR,
    duration_ms: 0,
    created_at: nowIso(),
  }
  const state = db()
  state.webhook_deliveries.push(delivery)
  const own = state.webhook_deliveries.filter((d) => d.webhook_id === webhookId)
  if (own.length > 100) {
    const drop = new Set(own.slice(0, own.length - 100).map((d) => d.id))
    state.webhook_deliveries = state.webhook_deliveries.filter((d) => !drop.has(d.id))
  }
  return delivery
}

/** Publishes a domain event to the listeners. */
export function emit(name: string, payload: { product_id?: number; total_delta?: number } = {}): void {
  if (name === 'stock.movement') checkMinimumStock(payload.product_id, payload.total_delta ?? 0)

  if (moduleEnabled('integrations')) {
    for (const webhook of db().webhooks) {
      if (webhook.active && (webhook.events.includes('*') || webhook.events.includes(name))) recordDelivery(webhook.id, name)
    }
  }
}

/** Notifies administrators and managers when a product drops below its minimum. */
function checkMinimumStock(productId: number | undefined, delta: number): void {
  if (productId === undefined || delta === 0 || !moduleEnabled('alerts')) return
  const product = productById(productId)
  if (!product || product.min_quantity === null) return
  const total = productTotal(product.id)
  const before = total - delta
  if (!(total < product.min_quantity && before >= product.min_quantity)) return

  const state = db()
  for (const user of state.users) {
    if (!user.is_active || (user.role !== 'admin' && user.role !== 'manager')) continue
    state.notifications.push({
      id: randomId(),
      user_id: user.id,
      data: {
        kind: 'low_stock',
        title: `Niski stan: ${product.name}`,
        message: `Zostało ${formatQuantity(total, ',')} ${product.unit} (minimum ${formatQuantity(product.min_quantity, ',')}).`,
        product_id: product.id,
        sku: product.sku,
        url: `/products/${product.id}`,
      },
      read_at: null,
      created_at: nowIso(),
    })
  }
}
