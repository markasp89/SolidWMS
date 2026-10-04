import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { EmptyState, Spinner } from '@/core/ui/misc'
import { useAuth } from './AuthContext'
import type { Role } from './types'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { hasRole } = useAuth()

  if (roles && !hasRole(...roles)) {
    return (
      <EmptyState icon="close" title="Brak dostępu">
        Nie masz uprawnień do tej sekcji.
      </EmptyState>
    )
  }
  return <>{children}</>
}
