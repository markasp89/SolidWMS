/**
 * Content of SolidWMS QR labels. Short on purpose so the QR codes stay small:
 *   SWMS:S:12        sector with id 12
 *   SWMS:P:P-00042   pallet
 *   SWMS:I:KART-40   product (SKU)
 * Anything else is treated as a product barcode / SKU / free text.
 */
export type ScanTarget =
  | { kind: 'sector'; id: number }
  | { kind: 'pallet'; code: string }
  | { kind: 'product'; sku: string }
  | { kind: 'text'; value: string }

export const labelCode = {
  sector: (id: number) => `SWMS:S:${id}`,
  pallet: (code: string) => `SWMS:P:${code}`,
  product: (sku: string) => `SWMS:I:${sku}`,
}

export function parseCode(raw: string): ScanTarget {
  const value = raw.trim()
  const match = /^SWMS:([SPI]):(.+)$/i.exec(value)
  if (match) {
    const [, kind, rest] = match
    if (kind.toUpperCase() === 'S' && /^\d+$/.test(rest)) return { kind: 'sector', id: Number(rest) }
    if (kind.toUpperCase() === 'P') return { kind: 'pallet', code: rest }
    if (kind.toUpperCase() === 'I') return { kind: 'product', sku: rest }
  }
  return { kind: 'text', value }
}
