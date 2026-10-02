export type Role = 'admin' | 'worker'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  role_label: string
  is_active: boolean
  created_at?: string
}
