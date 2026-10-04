/**
 * Row types of the in-browser demo database. They mirror the tables of the
 * Laravel backend (only the columns the API exposes or needs).
 */

export type Role = 'admin' | 'manager' | 'worker'

export interface ImageRef {
  /** data: URL of an uploaded image, or "asset:<name>" for bundled images. */
  url: string
  width: number
  height: number
}

export interface UserRow {
  id: number
  name: string
  email: string
  password: string
  role: Role
  is_active: boolean
  created_at: string
}

export interface TokenRow {
  token: string
  user_id: number
}

export interface WarehouseRow {
  id: number
  code: string
  name: string
  address: string | null
  description: string | null
  floor_plan: ImageRef | null
  created_at: string
  updated_at: string
}

export interface FloorRow {
  id: number
  warehouse_id: number
  name: string
  level: number
  floor_plan: ImageRef | null
  created_at: string
  updated_at: string
}

export type Point = [number, number]

export interface SectorRow {
  id: number
  warehouse_id: number
  floor_id: number | null
  code: string
  name: string
  color: string
  description: string | null
  shape: Point[] | null
  created_at: string
  updated_at: string
}

export interface ProductRow {
  id: number
  sku: string
  name: string
  barcode: string | null
  unit: string
  description: string | null
  min_quantity: number | null
  created_at: string
  updated_at: string
}

export interface StockRow {
  id: number
  product_id: number
  sector_id: number
  slot: string | null
  batch: string | null
  expires_at: string | null
  pallet_id: number | null
  quantity: number
  note: string | null
  updated_by: number | null
  created_at: string
  updated_at: string
}

export type MovementType = 'in' | 'out' | 'move' | 'adjust'

export interface MovementRow {
  id: number
  product_id: number
  type: MovementType
  quantity: number
  from_sector_id: number | null
  to_sector_id: number | null
  slot: string | null
  batch: string | null
  pallet_id: number | null
  user_id: number | null
  note: string | null
  reference: string | null
  created_at: string
}

export interface PalletRow {
  id: number
  code: string
  sector_id: number | null
  slot: string | null
  note: string | null
  created_by: number | null
  moved_by: number | null
  moved_at: string | null
  created_at: string
  updated_at: string
}

export interface NotificationData {
  kind: string
  title: string
  message: string
  product_id?: number
  sku?: string
  url: string
}

export interface NotificationRow {
  id: string
  user_id: number
  data: NotificationData
  read_at: string | null
  created_at: string
}

export type PhotoSubject = 'product' | 'stock_item' | 'pallet'

export interface PhotoRow {
  id: number
  subject_type: PhotoSubject
  subject_id: number
  url: string
  width: number | null
  height: number | null
  caption: string | null
  user_id: number | null
  created_at: string
}

export type StocktakeStatus = 'open' | 'completed' | 'cancelled'

export interface StocktakeRow {
  id: number
  sector_id: number
  status: StocktakeStatus
  note: string | null
  created_by: number | null
  completed_by: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface StocktakeLineRow {
  id: number
  stocktake_id: number
  stock_item_id: number | null
  product_id: number
  slot: string | null
  batch: string | null
  expires_at: string | null
  pallet_id: number | null
  expected: number
  counted: number | null
  counted_by: number | null
}

export type DocumentType = 'PZ' | 'WZ'

export interface DocumentRow {
  id: number
  type: DocumentType
  number: string
  status: 'draft' | 'posted'
  warehouse_id: number
  counterparty: string | null
  note: string | null
  created_by: number | null
  posted_by: number | null
  posted_at: string | null
  created_at: string
  updated_at: string
}

export interface DocumentLineRow {
  id: number
  document_id: number
  position: number
  product_id: number
  quantity: number
  sector_id: number | null
  stock_item_id: number | null
  slot: string | null
  batch: string | null
  expires_at: string | null
  note: string | null
  posted_locations: Array<{ label: string; quantity: number }> | null
}

export type PickListStatus = 'open' | 'completed' | 'cancelled'

export interface PickListRow {
  id: number
  number: string
  warehouse_id: number
  status: PickListStatus
  note: string | null
  created_by: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface PickLineRow {
  id: number
  pick_list_id: number
  sequence: number
  product_id: number
  stock_item_id: number | null
  sector_id: number | null
  slot: string | null
  batch: string | null
  expires_at: string | null
  quantity: number
  picked: number
  status: 'pending' | 'picked' | 'short'
  picked_by: number | null
  picked_at: string | null
}

export interface ApiKeyRow {
  id: number
  name: string
  prefix: string
  abilities: string[]
  last_used_at: string | null
  revoked_at: string | null
  created_by: number | null
  created_at: string
}

export interface WebhookRow {
  id: number
  name: string
  url: string
  events: string[]
  secret: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface WebhookDeliveryRow {
  id: number
  webhook_id: number
  event: string
  status_code: number | null
  error: string | null
  duration_ms: number | null
  created_at: string
}

export interface UserWarehouseRow {
  user_id: number
  warehouse_id: number
}

export interface Db {
  version: number
  seq: Record<string, number>
  modules: Record<string, boolean>
  users: UserRow[]
  tokens: TokenRow[]
  warehouses: WarehouseRow[]
  floors: FloorRow[]
  sectors: SectorRow[]
  products: ProductRow[]
  stock: StockRow[]
  movements: MovementRow[]
  pallets: PalletRow[]
  notifications: NotificationRow[]
  photos: PhotoRow[]
  stocktakes: StocktakeRow[]
  stocktake_lines: StocktakeLineRow[]
  documents: DocumentRow[]
  document_lines: DocumentLineRow[]
  pick_lists: PickListRow[]
  pick_lines: PickLineRow[]
  api_keys: ApiKeyRow[]
  webhooks: WebhookRow[]
  webhook_deliveries: WebhookDeliveryRow[]
  user_warehouse: UserWarehouseRow[]
}

/** Tables with numeric auto-increment ids. */
export type Table = {
  [K in keyof Db]: Db[K] extends Array<{ id: number }> ? K : never
}[keyof Db]
