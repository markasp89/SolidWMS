/**
 * Demo data: mirrors backend DatabaseSeeder + DemoWarehouseSeeder and adds a
 * second warehouse and two weeks of believable history.
 */
import { db, emptyDb, nextId, setClock, setDb } from './db'
import { localDate } from './http'
import { MODULES } from './modules'
import { DEMO_PLAN_ASSET } from './present'
import { locationLabel } from './repo'
import * as stock from './stock'
import type { Db, Point, ProductRow, Role, SectorRow, StockRow, UserRow } from './types'

const DAY = 86400000

/** Builds a fresh demo database (does not change the current one). */
export function createSeed(): Db {
  const previous = db()
  const real = new Date()
  /** Local time `days` ago at hh:mm. */
  const at = (days: number, hours: number, minutes = 0): Date => {
    const date = new Date(real.getTime() - days * DAY)
    date.setHours(hours, minutes, 0, 0)
    return date.getTime() > real.getTime() ? new Date(real.getTime() - 5 * 60000) : date
  }
  /** Expiry date `days` from today. */
  const expires = (days: number) => localDate(new Date(real.getTime() + days * DAY))

  setDb(emptyDb())
  try {
    const state = db()
    for (const m of MODULES) if (!m.required) state.modules[m.key] = true

    // Users -------------------------------------------------------------------------
    const created = at(21, 9).toISOString()
    const user = (name: string, email: string, role: Role): UserRow => {
      const row: UserRow = { id: nextId('users'), name, email, password: 'password', role, is_active: true, created_at: created }
      state.users.push(row)
      return row
    }
    const admin = user('Administrator', 'admin@solidwms.local', 'admin')
    const worker = user('Jan Pracownik', 'pracownik@solidwms.local', 'worker')
    const manager = user('Anna Kierownik', 'kierownik@solidwms.local', 'manager')

    // Warehouses and sectors --------------------------------------------------------
    const layoutTime = at(20, 10).toISOString()
    const warehouse = (code: string, name: string, address: string, description: string, plan: boolean) => {
      const row = {
        id: nextId('warehouses'),
        code,
        name,
        address,
        description,
        floor_plan: plan ? { url: DEMO_PLAN_ASSET, width: 1600, height: 1000 } : null,
        created_at: layoutTime,
        updated_at: layoutTime,
      }
      state.warehouses.push(row)
      return row
    }
    const sectors: Record<string, SectorRow> = {}
    const sector = (warehouseId: number, code: string, name: string, color: string, shape: Point[]) => {
      const row: SectorRow = {
        id: nextId('sectors'),
        warehouse_id: warehouseId,
        floor_id: null,
        code,
        name,
        color,
        description: null,
        shape,
        created_at: layoutTime,
        updated_at: layoutTime,
      }
      state.sectors.push(row)
      sectors[warehouseId === 1 ? code : `MAG2:${code}`] = row
      return row
    }
    /** Pixel rectangle on the 1600x1000 demo image. */
    const px = (x1: number, y1: number, x2: number, y2: number): Point[] => [
      [x1 / 1600, y1 / 1000],
      [x2 / 1600, y1 / 1000],
      [x2 / 1600, y2 / 1000],
      [x1 / 1600, y2 / 1000],
    ]

    const mag1 = warehouse('MAG1', 'Magazyn główny', 'ul. Przykładowa 1, Poznań', 'Magazyn demonstracyjny.', true)
    const colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c']
    ;['A', 'B', 'C', 'D'].forEach((row, i) => {
      const y = 90 + i * 150
      sector(mag1.id, `${row}1`, `Regał ${row} - lewa strona`, colors[i] ?? '#2563eb', px(80, y, 540, y + 70))
      sector(mag1.id, `${row}2`, `Regał ${row} - prawa strona`, colors[i] ?? '#2563eb', px(540, y, 1000, y + 70))
    })
    sector(mag1.id, 'BLOK', 'Składowanie blokowe', '#ca8a04', px(1150, 80, 1540, 560))
    sector(mag1.id, 'ROZ', 'Strefa rozładunku', '#16a34a', px(560, 720, 1250, 940))

    const mag2 = warehouse('MAG2', 'Hala B', 'ul. Magazynowa 7, Poznań', 'Mniejsza hala bez rzutu - sektory narysowane na siatce.', false)
    sector(mag2.id, 'R1', 'Regał R1', '#0891b2', px(100, 120, 700, 240))
    sector(mag2.id, 'R2', 'Regał R2', '#0891b2', px(100, 340, 700, 460))
    sector(mag2.id, 'CHL', 'Chłodnia', '#4f46e5', px(900, 120, 1500, 520))
    sector(mag2.id, 'WYD', 'Strefa wydań', '#16a34a', px(480, 660, 1500, 900))

    // Products and initial stock (two weeks ago) -------------------------------------
    type Location = [sector: string, quantity: number, slot?: string | null, batch?: string | null, expiresInDays?: number]
    const products: Record<string, ProductRow> = {}
    const definitions: Array<[string, string, string, number | null, string | null, Location[]]> = [
      ['PAL-EUR', 'Paleta EUR 1200x800', 'szt', 20, '5901234560017', [['ROZ', 24], ['BLOK', 60]]],
      ['KART-40', 'Karton 400x300x300', 'szt', 100, '5901234560024', [['A1', 350, '01-1']]],
      ['FOL-STR', 'Folia stretch 23µm', 'rol', 10, '5901234560031', [['A2', 48, '02-3']]],
      ['TAS-48', 'Taśma pakowa 48mm', 'szt', 50, '5901234560048', [['B1', 220, '01-2']]],
      ['SRB-M8', 'Śruba M8x40 (opak. 100)', 'opak', null, '5901234560055', [['C1', 35, '03-1'], ['C2', 12, '01-1']]],
      ['RKW-L', 'Rękawice robocze L', 'para', 30, '5901234560062', [['D1', 80]]],
      ['CEM-25', 'Cement 25kg', 'worek', null, '5901234560079', [['BLOK', 40, null, 'C-2405', 20], ['BLOK', 80, null, 'C-2409', 150]]],
      ['RKW-NIT', 'Rękawice nitrylowe M (100 szt.)', 'opak', 20, '5901234560086', [['MAG2:R1', 45, '01-1']]],
      ['PLY-MYJ', 'Płyn do mycia 5L', 'szt', null, '5901234560093', [['MAG2:R2', 18, '02-2', 'PM-2609', 5]]],
      ['WOD-05', 'Woda mineralna 0,5L (zgrzewka)', 'zgrz', 40, '5901234560109', [['MAG2:CHL', 60, null, 'W-2611', 45], ['MAG2:CHL', 30, null, 'W-2612', 120]]],
    ]
    let minute = 0
    for (const [sku, name, unit, min, barcode, locations] of definitions) {
      const time = at(14, 8, minute).toISOString()
      const product: ProductRow = {
        id: nextId('products'),
        sku,
        name,
        barcode,
        unit,
        description: null,
        min_quantity: min,
        created_at: time,
        updated_at: time,
      }
      state.products.push(product)
      products[sku] = product
      for (const [code, quantity, slot, batch, days] of locations) {
        setClock(at(14, 8, minute++ * 4 + 2))
        const target = sectors[code]
        if (!target) continue
        stock.receive(product.id, target.id, quantity, worker, 'Stan początkowy', {
          slot: slot ?? null,
          batch: batch ?? null,
          expires_at: days === undefined ? null : expires(days),
        })
      }
    }

    // History over the last two weeks ----------------------------------------------------
    const find = (sku: string, sectorCode: string, filter: (i: StockRow) => boolean = () => true): StockRow => {
      const item = db().stock.find((i) => i.product_id === products[sku]?.id && i.sector_id === sectors[sectorCode]?.id && filter(i))
      if (!item) throw new Error(`Seed: no stock of ${sku} in ${sectorCode}`)
      return item
    }
    const sectorId = (code: string) => sectors[code]?.id ?? 0
    const step = (date: Date, run: () => void) => {
      setClock(date)
      run()
    }

    step(at(13, 9, 15), () => stock.move(find('KART-40', 'A1'), sectorId('ROZ'), 50, worker, 'Do pakowania wysyłek'))
    step(at(12, 7, 40), () => stock.issue(find('PAL-EUR', 'BLOK'), 10, manager, 'Wydanie na zmianę'))
    step(at(11, 13, 5), () => stock.issue(find('TAS-48', 'B1'), 40, worker, 'Zamówienie 2214'))
    step(at(10, 10, 30), () =>
      stock.receive(products['CEM-25']?.id ?? 0, sectorId('BLOK'), 20, worker, 'Dostawa uzupełniająca', { batch: 'C-2409', expires_at: expires(150) }),
    )
    step(at(9, 14, 20), () => stock.adjust(find('SRB-M8', 'C2'), 10, manager, 'Korekta po kontroli', false))
    step(at(8, 11, 0), () => stock.move(find('FOL-STR', 'A2'), sectorId('A1'), 8, worker, null, { slot: '02-1' }))

    // A posted PZ document (gloves delivery).
    step(at(7, 9, 10), () => {
      const date = new Date(at(7, 9, 10).getTime())
      const number = `PZ/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/0001`
      const time = date.toISOString()
      const documentId = nextId('documents')
      state.documents.push({
        id: documentId,
        type: 'PZ',
        number,
        status: 'posted',
        warehouse_id: mag1.id,
        counterparty: 'BHP-Serwis Sp. z o.o.',
        note: 'Dostawa rękawic',
        created_by: admin.id,
        posted_by: admin.id,
        posted_at: time,
        created_at: time,
        updated_at: time,
      })
      const item = stock.receive(products['RKW-L']?.id ?? 0, sectorId('D1'), 40, admin, null, {}, number)
      state.document_lines.push({
        id: nextId('document_lines'),
        document_id: documentId,
        position: 1,
        product_id: products['RKW-L']?.id ?? 0,
        quantity: 40,
        sector_id: sectorId('D1'),
        stock_item_id: null,
        slot: null,
        batch: null,
        expires_at: null,
        note: null,
        posted_locations: [{ label: locationLabel(item), quantity: 40 }],
      })
    })

    step(at(6, 12, 45), () => stock.issue(find('CEM-25', 'BLOK', (i) => i.batch === 'C-2405'), 15, worker, 'Zamówienie 2231'))
    // Drops "Rękawice robocze L" below the minimum -> low stock notification for admin and manager.
    step(at(5, 15, 10), () => stock.issue(find('RKW-L', 'D1'), 95, manager, 'Wydanie dla brygady remontowej'))
    step(at(4, 8, 50), () => stock.move(find('TAS-48', 'B1'), sectorId('B2'), 30, worker, null, { slot: '03-1' }))
    step(at(3, 10, 25), () => stock.issue(find('KART-40', 'A1'), 120, worker, 'Zamówienie 2240'))
    step(at(2, 9, 0), () => stock.move(find('PAL-EUR', 'ROZ'), sectorId('BLOK'), 12, manager, 'Porządkowanie strefy rozładunku'))
    step(at(2, 13, 35), () => stock.issue(find('WOD-05', 'MAG2:CHL', (i) => i.batch === 'W-2611'), 12, worker, 'Zaopatrzenie biura'))
    step(at(1, 8, 15), () => stock.receive(products['RKW-NIT']?.id ?? 0, sectorId('MAG2:R1'), 15, worker, 'Dostawa', { slot: '01-1' }))

    // A mixed pallet waiting in the unloading zone.
    step(at(1, 9, 40), () => {
      const time = at(1, 9, 40).toISOString()
      const pallet = {
        id: nextId('pallets'),
        code: 'P-00001',
        sector_id: sectorId('ROZ'),
        slot: null,
        note: 'Dostawa od Pakmar',
        created_by: worker.id,
        moved_by: null,
        moved_at: null,
        created_at: time,
        updated_at: time,
      }
      state.pallets.push(pallet)
      for (const [sku, quantity] of [['TAS-48', 36], ['FOL-STR', 12]] as const) {
        stock.receive(products[sku]?.id ?? 0, sectorId('ROZ'), quantity, worker, null, { pallet_id: pallet.id }, pallet.code)
      }
    })

    step(at(1, 14, 5), () => stock.issue(find('FOL-STR', 'A1'), 6, admin, 'Owijanie palet wysyłkowych'))
    step(new Date(real.getTime() - 2 * 3600000), () => stock.move(find('SRB-M8', 'C1'), sectorId('C2'), 5, worker, null, { slot: '01-1' }))

    return db()
  } finally {
    setClock(null)
    setDb(previous)
  }
}
