import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { apiUrl } from '@/core/api/client'
import { Icon } from '@/core/ui/Icon'
import { centroid, clamp01, contrastColor, DEFAULT_PLAN, rectangle, round4, toSvgPoints } from '../geometry'
import type { Point, Sector, Warehouse } from '../types'

export type EditorMode = 'select' | 'rect' | 'polygon'

export interface FloorPlanEditor {
  mode: EditorMode
  /** A new shape was drawn (rectangle or polygon). */
  onDrawn: (shape: Point[]) => void
  /** The selected sector's shape was changed by dragging. */
  onShapeChange: (sectorId: number, shape: Point[]) => void
  onCancelDrawing?: () => void
}

export interface FloorPlanOverlayProps {
  warehouse: Warehouse
  sectors: Sector[]
  width: number
  height: number
  /** Multiply by this to get a size that looks the same at any zoom level. */
  unit: number
}

interface FloorPlanProps {
  warehouse: Warehouse
  sectors: Sector[]
  selectedId?: number | null
  highlightIds?: number[]
  onSelect?: (sector: Sector | null) => void
  editor?: FloorPlanEditor
  /** Extra SVG content drawn above the sectors (e.g. stock badges). */
  overlay?: (props: FloorPlanOverlayProps) => ReactNode
  toolbar?: ReactNode
  /** Compact read-only variant (e.g. inside search results). */
  compact?: boolean
}

type Drag =
  | { kind: 'vertex'; sectorId: number; index: number; shape: Point[] }
  | { kind: 'move'; sectorId: number; start: Point; original: Point[]; shape: Point[] }
  | { kind: 'rect'; start: Point; current: Point }

const ZOOM_LEVELS = [1, 1.5, 2, 3, 4]

export function FloorPlan({
  warehouse,
  sectors,
  selectedId = null,
  highlightIds = [],
  onSelect,
  editor,
  overlay,
  toolbar,
  compact = false,
}: FloorPlanProps) {
  const width = warehouse.floor_plan?.width ?? DEFAULT_PLAN.width
  const height = warehouse.floor_plan?.height ?? DEFAULT_PLAN.height
  const svgRef = useRef<SVGSVGElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [renderedWidth, setRenderedWidth] = useState(1000)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [polygon, setPolygon] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [imageFailed, setImageFailed] = useState(false)

  const mode = editor?.mode ?? 'select'
  const unit = width / Math.max(renderedWidth, 1) // plan units per screen pixel

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observer = new ResizeObserver(() => setRenderedWidth(svg.getBoundingClientRect().width))
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  // Reset the polygon being drawn when leaving polygon mode.
  useEffect(() => {
    if (mode !== 'polygon') setPolygon([])
  }, [mode])

  // Scroll the selected sector into view when zoomed in.
  useEffect(() => {
    const sector = sectors.find((s) => s.id === (highlightIds[0] ?? selectedId))
    const viewport = viewportRef.current
    if (!sector?.shape || !viewport || zoom === 1) return
    const [cx, cy] = centroid(sector.shape)
    viewport.scrollTo({
      left: cx * viewport.scrollWidth - viewport.clientWidth / 2,
      top: cy * viewport.scrollHeight - viewport.clientHeight / 2,
      behavior: 'smooth',
    })
  }, [selectedId, highlightIds, sectors, zoom])

  const toPoint = useCallback((event: { clientX: number; clientY: number }): Point => {
    const rect = svgRef.current!.getBoundingClientRect()
    return [round4(clamp01((event.clientX - rect.left) / rect.width)), round4(clamp01((event.clientY - rect.top) / rect.height))]
  }, [])

  const finishPolygon = useCallback(() => {
    if (polygon.length >= 3) editor?.onDrawn(polygon)
    setPolygon([])
  }, [polygon, editor])

  useEffect(() => {
    if (mode !== 'polygon' && mode !== 'rect') return
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input, textarea, select')) return
      if (event.key === 'Escape') {
        setPolygon([])
        setDrag(null)
        editor?.onCancelDrawing?.()
      } else if (event.key === 'Enter' && mode === 'polygon') {
        finishPolygon()
      } else if (event.key === 'Backspace' && mode === 'polygon') {
        event.preventDefault()
        setPolygon((p) => p.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, finishPolygon, editor])

  /* ---- pointer handling ------------------------------------------------- */

  const onBackgroundPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!editor || event.button !== 0) return
    if (mode === 'rect') {
      const p = toPoint(event)
      svgRef.current?.setPointerCapture(event.pointerId)
      setDrag({ kind: 'rect', start: p, current: p })
    }
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (mode === 'polygon') setCursor(toPoint(event))
    if (!drag) return
    const p = toPoint(event)
    if (drag.kind === 'rect') {
      setDrag({ ...drag, current: p })
    } else if (drag.kind === 'vertex') {
      const shape = drag.shape.map((v, i) => (i === drag.index ? p : v))
      setDrag({ ...drag, shape })
    } else {
      const dx = p[0] - drag.start[0]
      const dy = p[1] - drag.start[1]
      // Keep the whole shape on the plan.
      const minX = Math.min(...drag.original.map((v) => v[0]))
      const maxX = Math.max(...drag.original.map((v) => v[0]))
      const minY = Math.min(...drag.original.map((v) => v[1]))
      const maxY = Math.max(...drag.original.map((v) => v[1]))
      const cdx = Math.min(Math.max(dx, -minX), 1 - maxX)
      const cdy = Math.min(Math.max(dy, -minY), 1 - maxY)
      setDrag({ ...drag, shape: drag.original.map(([x, y]) => [round4(x + cdx), round4(y + cdy)] as Point) })
    }
  }

  const onPointerUp = () => {
    if (!drag) return
    if (drag.kind === 'rect') {
      const shape = rectangle(drag.start, drag.current)
      const [a, , c] = shape
      if (Math.abs(c[0] - a[0]) * renderedWidth > 6 && Math.abs(c[1] - a[1]) * renderedWidth * (height / width) > 6) {
        editor?.onDrawn(shape)
      }
    } else {
      const original = drag.kind === 'move' ? drag.original : sectors.find((s) => s.id === drag.sectorId)?.shape
      if (JSON.stringify(original) !== JSON.stringify(drag.shape)) {
        editor?.onShapeChange(drag.sectorId, drag.shape)
      }
    }
    setDrag(null)
  }

  const onSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (mode === 'polygon' && editor) {
      const p = toPoint(event)
      if (polygon.length >= 3) {
        const [fx, fy] = polygon[0]
        const distancePx = Math.hypot((fx - p[0]) * renderedWidth, ((fy - p[1]) * renderedWidth * height) / width)
        if (distancePx < 12) {
          finishPolygon()
          return
        }
      }
      setPolygon((prev) => [...prev, p])
      return
    }
    if (mode === 'select' && event.target === event.currentTarget) onSelect?.(null)
  }

  const onSectorPointerDown = (event: PointerEvent<SVGPolygonElement>, sector: Sector) => {
    if (mode !== 'select') return
    event.stopPropagation()
    if (editor && sector.id === selectedId && sector.shape) {
      svgRef.current?.setPointerCapture(event.pointerId)
      setDrag({ kind: 'move', sectorId: sector.id, start: toPoint(event), original: sector.shape, shape: sector.shape })
    }
  }

  const onVertexPointerDown = (event: PointerEvent<SVGCircleElement>, sector: Sector, index: number) => {
    event.stopPropagation()
    if (!sector.shape) return
    if (event.altKey && sector.shape.length > 3) {
      editor?.onShapeChange(sector.id, sector.shape.filter((_, i) => i !== index))
      return
    }
    svgRef.current?.setPointerCapture(event.pointerId)
    setDrag({ kind: 'vertex', sectorId: sector.id, index, shape: sector.shape })
  }

  /* ---- rendering -------------------------------------------------------- */

  const shapeOf = (sector: Sector): Point[] | null =>
    drag && drag.kind !== 'rect' && drag.sectorId === sector.id ? drag.shape : sector.shape

  const fontSize = Math.max(11 * unit, Math.min(width, height) / 45)
  const visible = sectors.filter((s) => s.shape && s.shape.length >= 3)
  const selected = sectors.find((s) => s.id === selectedId)

  return (
    <div className={`plan ${compact ? 'plan-compact' : ''} plan-mode-${mode}`}>
      {!compact && (
        <div className="plan-toolbar">
          {toolbar}
          <div className="plan-zoom">
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setZoom((z) => ZOOM_LEVELS[Math.max(ZOOM_LEVELS.indexOf(z) - 1, 0)])}
              disabled={zoom === ZOOM_LEVELS[0]}
              aria-label="Pomniejsz"
            >
              <Icon name="zoomOut" />
            </button>
            <span className="plan-zoom-value">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setZoom((z) => ZOOM_LEVELS[Math.min(ZOOM_LEVELS.indexOf(z) + 1, ZOOM_LEVELS.length - 1)])}
              disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              aria-label="Powiększ"
            >
              <Icon name="zoomIn" />
            </button>
          </div>
        </div>
      )}

      <div className="plan-viewport" ref={viewportRef}>
        <div className="plan-stage" style={{ width: `${zoom * 100}%`, aspectRatio: `${width} / ${height}` }}>
          {warehouse.floor_plan && !imageFailed ? (
            <img
              className="plan-image"
              src={apiUrl(warehouse.floor_plan.url)}
              alt={`Rzut magazynu ${warehouse.name}`}
              draggable={false}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="plan-placeholder">{!compact && <span>Brak rzutu magazynu</span>}</div>
          )}

          <svg
            ref={svgRef}
            className="plan-svg"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            onPointerDown={onBackgroundPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => setCursor(null)}
            onClick={onSvgClick}
            onDoubleClick={() => mode === 'polygon' && finishPolygon()}
          >
            {visible.map((sector) => {
              const shape = shapeOf(sector)!
              const isSelected = sector.id === selectedId
              const isHighlighted = highlightIds.includes(sector.id)
              const dimmed = highlightIds.length > 0 && !isHighlighted
              const [cx, cy] = centroid(shape)
              return (
                <g
                  key={sector.id}
                  className={`plan-sector ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''} ${dimmed ? 'is-dimmed' : ''}`}
                  onClick={(e) => {
                    if (mode !== 'select') return
                    e.stopPropagation()
                    onSelect?.(sector)
                  }}
                >
                  <title>{`${sector.code} – ${sector.name}`}</title>
                  <polygon
                    points={toSvgPoints(shape, width, height)}
                    fill={sector.color}
                    stroke={sector.color}
                    strokeWidth={(isSelected || isHighlighted ? 3 : 1.5) * unit}
                    onPointerDown={(e) => onSectorPointerDown(e, sector)}
                  />
                  <text
                    x={cx * width}
                    y={cy * height}
                    fontSize={fontSize}
                    fill={contrastColor(sector.color)}
                    stroke={sector.color}
                    strokeWidth={fontSize / 5}
                    className="plan-label"
                  >
                    {sector.code}
                  </text>
                </g>
              )
            })}

            {overlay?.({ warehouse, sectors: visible, width, height, unit })}

            {/* Vertex handles of the selected sector */}
            {editor && mode === 'select' && selected?.shape &&
              shapeOf(selected)!.map(([x, y], index) => (
                <circle
                  key={index}
                  className="plan-handle"
                  cx={x * width}
                  cy={y * height}
                  r={7 * unit}
                  strokeWidth={2 * unit}
                  onPointerDown={(e) => onVertexPointerDown(e, selected, index)}
                >
                  <title>Przeciągnij, aby zmienić kształt. Alt + klik usuwa punkt.</title>
                </circle>
              ))}

            {/* Rectangle being drawn */}
            {drag?.kind === 'rect' && (
              <polygon
                className="plan-draft"
                points={toSvgPoints(rectangle(drag.start, drag.current), width, height)}
                strokeWidth={2 * unit}
                strokeDasharray={`${6 * unit} ${4 * unit}`}
              />
            )}

            {/* Polygon being drawn */}
            {polygon.length > 0 && (
              <g className="plan-draft">
                <polyline
                  points={toSvgPoints(cursor ? [...polygon, cursor] : polygon, width, height)}
                  strokeWidth={2 * unit}
                  strokeDasharray={`${6 * unit} ${4 * unit}`}
                />
                {polygon.map(([x, y], i) => (
                  <circle key={i} cx={x * width} cy={y * height} r={(i === 0 ? 7 : 4) * unit} strokeWidth={2 * unit} />
                ))}
              </g>
            )}
          </svg>
        </div>
      </div>

      {editor && mode === 'polygon' && (
        <p className="plan-hint">
          Klikaj, aby dodać kolejne punkty. Zakończ klikając pierwszy punkt, podwójnym kliknięciem lub Enter. Backspace
          cofa punkt, Esc anuluje.
        </p>
      )}
      {editor && mode === 'rect' && <p className="plan-hint">Przeciągnij myszą (lub palcem), aby zaznaczyć prostokątny sektor.</p>}
      {editor && mode === 'select' && selected && (
        <p className="plan-hint">Przeciągnij sektor, aby go przesunąć, lub jego narożniki, aby zmienić kształt.</p>
      )}
    </div>
  )
}
