import type { Point } from './types'

export const DEFAULT_PLAN = { width: 1600, height: 1000 }

/** Area-weighted centroid of a polygon (falls back to the vertex average). */
export function centroid(points: Point[]): Point {
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    const cross = x1 * y2 - x2 * y1
    area += cross
    cx += (x1 + x2) * cross
    cy += (y1 + y2) * cross
  }
  if (Math.abs(area) < 1e-9) {
    const n = points.length || 1
    return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n]
  }
  area /= 2
  return [cx / (6 * area), cy / (6 * area)]
}

export function bounds(points: Point[]) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export const round4 = (v: number) => Math.round(v * 10000) / 10000

export function rectangle(a: Point, b: Point): Point[] {
  const [x1, x2] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])]
  const [y1, y2] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])]
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ].map(([x, y]) => [round4(x), round4(y)] as Point)
}

export function toSvgPoints(points: Point[], width: number, height: number): string {
  return points.map(([x, y]) => `${x * width},${y * height}`).join(' ')
}

/** Picks a readable text colour (black/white) for a background colour. */
export function contrastColor(hex: string): string {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111827' : '#ffffff'
}

export const SECTOR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2']
