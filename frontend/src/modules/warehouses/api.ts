import { api, request } from '@/core/api/client'
import type { Floor, Point, Sector, Warehouse } from './types'

export interface WarehouseInput {
  code: string
  name: string
  address: string
  description: string
}

export interface SectorInput {
  code: string
  name: string
  color: string
  description: string
  shape?: Point[] | null
  floor_id?: number | null
}

export const warehousesApi = {
  list: (signal?: AbortSignal) => api.get<Warehouse[]>('/warehouses', undefined, signal),
  get: (id: number | string, signal?: AbortSignal) => api.get<Warehouse>(`/warehouses/${id}`, undefined, signal),
  create: (data: WarehouseInput) => api.post<Warehouse>('/warehouses', data),
  update: (id: number, data: Partial<WarehouseInput>) => api.patch<Warehouse>(`/warehouses/${id}`, data),
  remove: (id: number) => api.delete(`/warehouses/${id}`),

  uploadFloorPlan: (id: number, file: File) => {
    const body = new FormData()
    body.append('floor_plan', file)
    return request<Warehouse>(`/warehouses/${id}/floor-plan`, { method: 'POST', body })
  },
  removeFloorPlan: (id: number) => api.delete<Warehouse>(`/warehouses/${id}/floor-plan`),

  createSector: (warehouseId: number, data: SectorInput) =>
    api.post<Sector>(`/warehouses/${warehouseId}/sectors`, data),
  updateSector: (id: number, data: Partial<SectorInput>) => api.patch<Sector>(`/sectors/${id}`, data),
  removeSector: (id: number) => api.delete(`/sectors/${id}`),
  sector: (id: number | string, signal?: AbortSignal) => api.get<Sector>(`/sectors/${id}`, undefined, signal),

  // Floors (module "floors")
  floors: (warehouseId: number, signal?: AbortSignal) => api.get<Floor[]>(`/warehouses/${warehouseId}/floors`, undefined, signal),
  createFloor: (warehouseId: number, data: { name: string; level?: number }) =>
    api.post<Floor>(`/warehouses/${warehouseId}/floors`, data),
  updateFloor: (id: number, data: { name?: string; level?: number }) => api.patch<Floor>(`/floors/${id}`, data),
  removeFloor: (id: number) => api.delete(`/floors/${id}`),
  uploadFloorPlanOf: (floorId: number, file: File) => {
    const body = new FormData()
    body.append('floor_plan', file)
    return request<Floor>(`/floors/${floorId}/plan`, { method: 'POST', body })
  },
  removeFloorPlanOf: (floorId: number) => api.delete<Floor>(`/floors/${floorId}/plan`),
}

/** Loads every warehouse with its sectors (for sector pickers). */
export async function loadAllSectors(signal?: AbortSignal): Promise<Warehouse[]> {
  const list = await warehousesApi.list(signal)
  return Promise.all(list.map((w) => warehousesApi.get(w.id, signal)))
}
