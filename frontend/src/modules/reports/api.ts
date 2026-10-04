import { api } from '@/core/api/client'
import type { ActivityRow, OccupancyRow, Period, PeriodReport, RotationRow } from './types'

export const reportsApi = {
  occupancy: (warehouseId: number | '', signal?: AbortSignal) =>
    api.get<OccupancyRow[]>('/reports/occupancy', { warehouse_id: warehouseId }, signal),
  rotation: (period: Period, signal?: AbortSignal) =>
    api.get<PeriodReport<RotationRow>>('/reports/rotation', { ...period }, signal),
  activity: (period: Period, signal?: AbortSignal) =>
    api.get<PeriodReport<ActivityRow>>('/reports/activity', { ...period }, signal),
}
