import type { Product } from '@/modules/inventory'

/** A document line while it is being edited (strings as typed by the user). */
export interface EditorLine {
  key: string
  product: Product | null
  quantity: string
  sector_id: number | ''
  /** WZ: exact source location chosen earlier; kept as long as the warehouse does not change. */
  stock_item_id: number | null
  slot: string
  batch: string
  expires_at: string
  note: string
}

let nextKey = 1
export const newLineKey = () => `line-${nextKey++}`

export const emptyLine = (): EditorLine => ({
  key: newLineKey(),
  product: null,
  quantity: '',
  sector_id: '',
  stock_item_id: null,
  slot: '',
  batch: '',
  expires_at: '',
  note: '',
})
