/** Point in coordinates normalised to the floor plan (0..1). */
export type Point = [number, number]

export interface Sector {
  id: number
  warehouse_id: number
  /** Floor (module "floors"); null = main floor plan of the warehouse. */
  floor_id?: number | null
  code: string
  name: string
  color: string
  description: string | null
  shape: Point[] | null
  warehouse?: { id: number; code: string; name: string }
  updated_at?: string
}

export interface FloorPlan {
  url: string
  width: number
  height: number
}

export interface Warehouse {
  id: number
  code: string
  name: string
  address: string | null
  description: string | null
  floor_plan: FloorPlan | null
  sectors_count?: number
  sectors?: Sector[]
  updated_at?: string
}

export interface Floor {
  id: number
  warehouse_id: number
  name: string
  level: number
  floor_plan: FloorPlan | null
  sectors_count?: number
}
