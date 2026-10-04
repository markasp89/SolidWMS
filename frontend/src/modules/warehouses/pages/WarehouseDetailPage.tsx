import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { useAsync } from '@/core/hooks/useAsync'
import { Extension, useModuleEnabled } from '@/core/modules/registry'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { Icon } from '@/core/ui/Icon'
import { Card, ColorDot, EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { warehousesApi } from '../api'
import { FloorPlan, type EditorMode } from '../components/FloorPlan'
import { FloorFormModal } from '../components/FloorFormModal'
import { SectorFormModal } from '../components/SectorFormModal'
import { WarehouseFormModal } from '../components/WarehouseFormModal'
import type { Floor, Point, Sector, Warehouse } from '../types'

export function WarehouseDetailPage() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data: warehouse, error, loading, reload, setData } = useAsync((signal) => warehousesApi.get(id!, signal), [id])

  const [editing, setEditing] = useState(false)
  const [mode, setMode] = useState<EditorMode>('select')
  const [newShape, setNewShape] = useState<Point[] | null>(null)
  const [redrawId, setRedrawId] = useState<number | null>(null)
  const [editSector, setEditSector] = useState<Sector | null>(null)
  const [addWithoutShape, setAddWithoutShape] = useState(false)
  const [editWarehouse, setEditWarehouse] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const sectors = useMemo(() => warehouse?.sectors ?? [], [warehouse])
  const selectedId = params.get('sector') ? Number(params.get('sector')) : null
  const selected = sectors.find((s) => s.id === selectedId) ?? null
  const highlightIds = params.get('highlight')?.split(',').map(Number).filter(Boolean) ?? []

  // Floors (module "floors"): every floor has its own plan and sectors.
  const floorsEnabled = useModuleEnabled('floors')
  const floorsState = useAsync(
    (signal) => (floorsEnabled ? warehousesApi.floors(Number(id), signal) : Promise.resolve([] as Floor[])),
    [id, floorsEnabled],
  )
  const floors = floorsState.data ?? []
  const [editFloor, setEditFloor] = useState<Floor | 'new' | null>(null)
  const highlightedFloor = sectors.find((s) => highlightIds.includes(s.id))?.floor_id
  const currentFloorId: number | null = !floorsEnabled
    ? null
    : params.has('floor')
      ? Number(params.get('floor')) || null
      : (selected?.floor_id ?? highlightedFloor ?? null)
  const currentFloor = floors.find((f) => f.id === currentFloorId) ?? null
  const floorSectors = floorsEnabled ? sectors.filter((s) => (s.floor_id ?? null) === (currentFloor?.id ?? null)) : sectors
  const plan = currentFloor ? currentFloor.floor_plan : (warehouse?.floor_plan ?? null)
  const floorName = (floorId: number | null | undefined) => floors.find((f) => f.id === floorId)?.name ?? 'Rzut główny'

  const selectFloor = (floorId: number | null) => {
    const next = new URLSearchParams(params)
    next.set('floor', String(floorId ?? 0))
    next.delete('sector')
    next.delete('highlight')
    setParams(next, { replace: true })
  }

  const select = (sector: Sector | null) => {
    const next = new URLSearchParams(params)
    if (sector) {
      next.set('sector', String(sector.id))
      if (floorsEnabled) next.set('floor', String(sector.floor_id ?? 0))
    } else next.delete('sector')
    next.delete('highlight')
    setParams(next, { replace: true })
  }

  const replaceSector = (sector: Sector) =>
    setData((w) => {
      const list = w!.sectors ?? []
      const exists = list.some((s) => s.id === sector.id)
      const sectors = (exists ? list.map((s) => (s.id === sector.id ? sector : s)) : [...list, sector]).sort((a, b) =>
        a.code.localeCompare(b.code, 'pl', { numeric: true }),
      )
      return { ...w!, sectors, sectors_count: sectors.length }
    })

  const saveShape = async (sectorId: number, shape: Point[]) => {
    try {
      replaceSector(await warehousesApi.updateSector(sectorId, { shape }))
    } catch (e) {
      toast((e as Error).message, 'error')
      reload()
    }
  }

  const onDrawn = (shape: Point[]) => {
    setMode('select')
    if (redrawId) {
      const id = redrawId
      setRedrawId(null)
      void saveShape(id, shape).then(() => toast('Obszar sektora został zaktualizowany.'))
    } else {
      setNewShape(shape)
    }
  }

  const deleteSector = async (sector: Sector) => {
    const ok = await confirm({
      title: 'Usunąć sektor?',
      message: `Sektor ${sector.code} – ${sector.name} zostanie usunięty. Sektora, w którym jest towar, nie można usunąć.`,
      confirmLabel: 'Usuń',
      danger: true,
    })
    if (!ok) return
    try {
      await warehousesApi.removeSector(sector.id)
      setData((w) => ({ ...w!, sectors: w!.sectors!.filter((s) => s.id !== sector.id) }))
      select(null)
      toast('Sektor usunięty.')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const deleteWarehouse = async (w: Warehouse) => {
    const ok = await confirm({
      title: 'Usunąć magazyn?',
      message: `Magazyn ${w.name} wraz z rzutem i wszystkimi sektorami zostanie usunięty. Operacja jest możliwa tylko, gdy w magazynie nie ma towaru.`,
      confirmLabel: 'Usuń magazyn',
      danger: true,
    })
    if (!ok) return
    try {
      await warehousesApi.remove(w.id)
      toast('Magazyn usunięty.')
      navigate('/warehouses')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const uploadPlan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !warehouse) return
    setUploading(true)
    try {
      if (currentFloor) {
        const updated = await warehousesApi.uploadFloorPlanOf(currentFloor.id, file)
        floorsState.setData((list) => (list ?? []).map((f) => (f.id === updated.id ? updated : f)))
      } else {
        setData(await warehousesApi.uploadFloorPlan(warehouse.id, file))
      }
      toast('Rzut został wgrany.')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const removePlan = async () => {
    if (!warehouse) return
    const ok = await confirm({
      title: 'Usunąć rzut?',
      message: 'Obraz rzutu zostanie usunięty. Sektory pozostaną bez zmian.',
      confirmLabel: 'Usuń rzut',
      danger: true,
    })
    if (!ok) return
    try {
      if (currentFloor) {
        const updated = await warehousesApi.removeFloorPlanOf(currentFloor.id)
        floorsState.setData((list) => (list ?? []).map((f) => (f.id === updated.id ? updated : f)))
      } else {
        setData(await warehousesApi.removeFloorPlan(warehouse.id))
      }
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const deleteFloor = async (floor: Floor) => {
    const ok = await confirm({
      title: 'Usunąć piętro?',
      message: `Piętro „${floor.name}” i jego rzut zostaną usunięte. Najpierw usuń sektory z tego piętra.`,
      confirmLabel: 'Usuń piętro',
      danger: true,
    })
    if (!ok) return
    try {
      await warehousesApi.removeFloor(floor.id)
      floorsState.setData((list) => (list ?? []).filter((f) => f.id !== floor.id))
      selectFloor(null)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  if (error) return <ErrorMessage error={error} onRetry={reload} />
  if (loading && !warehouse) return <Spinner />
  if (!warehouse) return null

  const nextCode = `S${sectors.length + 1}`
  const filtered = sectors.filter((s) =>
    `${s.code} ${s.name}`.toLowerCase().includes(filter.trim().toLowerCase()),
  )

  const editorToolbar = editing && (
    <div className="segmented" role="group" aria-label="Narzędzia">
      {(
        [
          ['select', 'pointer', 'Zaznacz'],
          ['rect', 'rect', 'Prostokąt'],
          ['polygon', 'polygon', 'Wielokąt'],
        ] as const
      ).map(([value, icon, label]) => (
        <button
          key={value}
          type="button"
          className={mode === value ? 'is-active' : ''}
          onClick={() => {
            setMode(value)
            if (value === 'select') setRedrawId(null)
          }}
        >
          <Icon name={icon} size={16} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )

  return (
    <>
      <PageHeader
        back={
          <Link to="/warehouses" className="link-muted">
            ← Magazyny
          </Link>
        }
        title={
          <>
            <span className="badge badge-lg">{warehouse.code}</span> {warehouse.name}
          </>
        }
        subtitle={warehouse.address}
        actions={
          isAdmin && (
            <>
              <Button
                variant={editing ? 'primary' : 'secondary'}
                icon={editing ? 'check' : 'edit'}
                onClick={() => {
                  setEditing((v) => !v)
                  setMode('select')
                  setRedrawId(null)
                }}
              >
                {editing ? 'Zakończ edycję' : 'Edytuj układ'}
              </Button>
              <Button icon="settings" onClick={() => setEditWarehouse(true)} title="Dane magazynu" aria-label="Dane magazynu" />
              <Button icon="trash" variant="ghost" onClick={() => deleteWarehouse(warehouse)} title="Usuń magazyn" aria-label="Usuń magazyn" />
            </>
          )
        }
      />

      {editing && (
        <div className="editor-bar">
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={uploadPlan} />
          <Button icon="upload" loading={uploading} onClick={() => fileInput.current?.click()}>
            {plan ? 'Zmień rzut' : currentFloor ? `Wgraj rzut: ${currentFloor.name}` : 'Wgraj rzut magazynu'}
          </Button>
          {plan && (
            <Button icon="trash" variant="ghost" onClick={removePlan}>
              Usuń rzut
            </Button>
          )}
          <span className="editor-bar-hint">
            Wybierz narzędzie „Prostokąt” lub „Wielokąt” i zaznacz obszar sektora na rzucie.
          </span>
        </div>
      )}
      {redrawId && (
        <div className="alert alert-info">
          Narysuj nowy obszar dla sektora <strong>{sectors.find((s) => s.id === redrawId)?.code}</strong>.{' '}
          <button type="button" className="link" onClick={() => { setRedrawId(null); setMode('select') }}>
            Anuluj
          </button>
        </div>
      )}

      <div className="split">
        <div className="split-main">
          {floorsEnabled && (floors.length > 0 || (isAdmin && editing)) && (
            <div className="floor-tabs" role="tablist" aria-label="Piętra">
              {[null, ...floors].map((floor) => (
                <button
                  key={floor?.id ?? 'main'}
                  type="button"
                  role="tab"
                  aria-selected={(currentFloor?.id ?? null) === (floor?.id ?? null)}
                  className={(currentFloor?.id ?? null) === (floor?.id ?? null) ? 'is-active' : ''}
                  onClick={() => selectFloor(floor?.id ?? null)}
                >
                  <Icon name="layers" size={15} /> {floor?.name ?? 'Rzut główny'}
                </button>
              ))}
              {isAdmin && editing && (
                <>
                  <Button size="sm" variant="ghost" icon="plus" onClick={() => setEditFloor('new')}>
                    Piętro
                  </Button>
                  {currentFloor && (
                    <>
                      <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditFloor(currentFloor)} aria-label="Zmień piętro" title="Zmień nazwę piętra" />
                      <Button size="sm" variant="ghost" icon="trash" onClick={() => deleteFloor(currentFloor)} aria-label="Usuń piętro" title="Usuń piętro" />
                    </>
                  )}
                </>
              )}
            </div>
          )}
          <FloorPlan
            key={currentFloor?.id ?? 'main'}
            warehouse={warehouse}
            plan={plan}
            sectors={floorSectors}
            selectedId={selectedId}
            highlightIds={highlightIds}
            onSelect={select}
            toolbar={editorToolbar}
            editor={
              editing
                ? {
                    mode,
                    onDrawn,
                    onShapeChange: saveShape,
                    onCancelDrawing: () => {
                      setMode('select')
                      setRedrawId(null)
                    },
                  }
                : undefined
            }
            overlay={(props) => <Extension name="warehouse.mapOverlay" props={props} />}
          />
        </div>

        <aside className="split-side">
          {selected ? (
            <Card
              className="sector-card"
              title={
                <>
                  <ColorDot color={selected.color} /> {selected.code} <span className="muted">· {selected.name}</span>
                </>
              }
              actions={
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => select(null)} aria-label="Zamknij">
                  <Icon name="close" />
                </button>
              }
            >
              {selected.description && <p className="muted">{selected.description}</p>}
              {isAdmin && editing && (
                <div className="button-row">
                  <Button size="sm" icon="edit" onClick={() => setEditSector(selected)}>
                    Edytuj
                  </Button>
                  <Button
                    size="sm"
                    icon="rect"
                    onClick={() => {
                      setRedrawId(selected.id)
                      setMode('rect')
                    }}
                  >
                    Narysuj obszar
                  </Button>
                  <Button size="sm" icon="trash" variant="ghost" onClick={() => deleteSector(selected)}>
                    Usuń
                  </Button>
                </div>
              )}
              {floorsEnabled && selected.floor_id && <p className="muted">Piętro: {floorName(selected.floor_id)}</p>}
              <div className="button-row">
                <Extension name="sector.actions" props={{ warehouse, sector: selected }} />
              </div>
              <Extension name="warehouse.sectorPanel" props={{ warehouse, sector: selected }} />
            </Card>
          ) : (
            <Card
              title={`Sektory (${sectors.length})`}
              actions={
                isAdmin &&
                editing && (
                  <Button size="sm" icon="plus" onClick={() => setAddWithoutShape(true)}>
                    Dodaj
                  </Button>
                )
              }
            >
              {sectors.length > 5 && (
                <input
                  className="input input-sm"
                  type="search"
                  placeholder="Filtruj sektory…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              )}
              {sectors.length === 0 ? (
                <EmptyState icon="map" title="Brak sektorów">
                  {isAdmin ? 'Kliknij „Edytuj układ” i zaznacz sektory na rzucie.' : 'Administrator nie zdefiniował jeszcze sektorów.'}
                </EmptyState>
              ) : (
                <ul className="list">
                  {filtered.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="list-item" onClick={() => select(s)}>
                        <ColorDot color={s.color} />
                        <strong>{s.code}</strong>
                        <span className="list-item-text">{s.name}</span>
                        {floorsEnabled && s.floor_id && <span className="badge">{floorName(s.floor_id)}</span>}
                        {!s.shape && <span className="badge badge-warn">bez obszaru</span>}
                        <Icon name="chevronRight" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </aside>
      </div>

      {newShape && (
        <SectorFormModal
          warehouseId={warehouse.id}
          shape={newShape}
          floorId={currentFloor?.id ?? null}
          suggestedCode={nextCode}
          onClose={() => setNewShape(null)}
          onSaved={(s) => {
            setNewShape(null)
            replaceSector(s)
            select(s)
            toast(`Sektor ${s.code} dodany.`)
          }}
        />
      )}
      {addWithoutShape && (
        <SectorFormModal
          warehouseId={warehouse.id}
          suggestedCode={nextCode}
          floorId={currentFloor?.id ?? null}
          onClose={() => setAddWithoutShape(false)}
          onSaved={(s) => {
            setAddWithoutShape(false)
            replaceSector(s)
            select(s)
          }}
        />
      )}
      {editSector && (
        <SectorFormModal
          warehouseId={warehouse.id}
          sector={editSector}
          onClose={() => setEditSector(null)}
          onSaved={(s) => {
            setEditSector(null)
            replaceSector(s)
            toast('Zapisano zmiany.')
          }}
        />
      )}
      {editFloor && (
        <FloorFormModal
          warehouseId={warehouse.id}
          floor={editFloor === 'new' ? undefined : editFloor}
          onClose={() => setEditFloor(null)}
          onSaved={(floor) => {
            setEditFloor(null)
            floorsState.setData((list) => {
              const rest = (list ?? []).filter((f) => f.id !== floor.id)
              return [...rest, floor].sort((a, b) => a.level - b.level || a.id - b.id)
            })
            selectFloor(floor.id)
          }}
        />
      )}
      {editWarehouse && (
        <WarehouseFormModal
          warehouse={warehouse}
          onClose={() => setEditWarehouse(false)}
          onSaved={(w) => {
            setEditWarehouse(false)
            setData(w)
            toast('Zapisano zmiany.')
          }}
        />
      )}
    </>
  )
}
